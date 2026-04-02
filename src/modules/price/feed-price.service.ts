import { Injectable, Logger } from '@nestjs/common';
import { ethers } from 'ethers';

import { USD_QUOTE_ALIASES } from './constants';
import { PriceFeedContract, RawPriceFeedRoundData } from './type/collateral-price-contract.type';
import { FeedPriceRequest, FeedSnapshot } from './type/feed-price.type';
import { QuotePriceService } from './quote-price.service';

import { ProviderFactory } from '@/common/chains/network/provider.factory';
import PriceFeedABI from '@/modules/contract/abi/PriceFeedABI.json';

@Injectable()
export class FeedPriceService {
  private readonly logger = new Logger(FeedPriceService.name);
  private readonly snapshotCache = new Map<string, FeedSnapshot>();

  constructor(
    private readonly providerFactory: ProviderFactory,
    private readonly quotePriceService: QuotePriceService,
  ) {}

  async getUsdPrice(request: FeedPriceRequest): Promise<number> {
    const snapshot = await this.readFeed(request);
    return this.resolveUsdPrice(request, snapshot);
  }

  async resolveUsdPrice(request: FeedPriceRequest, snapshot: FeedSnapshot): Promise<number> {
    const normalizedRequest = this.normalizeRequest(request);

    switch (snapshot.kind) {
      case 'direct_usd':
        return snapshot.price;
      case 'quoted':
        if (!snapshot.quoteSymbol) {
          throw new Error(`Missing quote symbol for feed ${snapshot.address}`);
        }
        return (
          snapshot.price *
          (await this.quotePriceService.getUsdPrice({
            blockTag: normalizedRequest.blockTag,
            date: normalizedRequest.date,
            network: normalizedRequest.network,
            symbol: snapshot.quoteSymbol,
          }))
        );
      case 'constant':
        return snapshot.price * (await this.resolveConstantUsdPrice(normalizedRequest));
      case 'unknown':
        return this.resolveUnknownUsdPrice(normalizedRequest, snapshot);
      default:
        throw new Error(`Unsupported feed kind for ${snapshot.address}`);
    }
  }

  async readFeed(request: FeedPriceRequest): Promise<FeedSnapshot> {
    const normalizedRequest = this.normalizeRequest(request);
    const { assetSymbol, blockTag, date, feedAddress, network } = normalizedRequest;
    const snapshotCacheKey = this.getSnapshotCacheKey(normalizedRequest);
    const cachedSnapshot = this.snapshotCache.get(snapshotCacheKey);
    if (cachedSnapshot) {
      return cachedSnapshot;
    }

    const provider = this.providerFactory.multicall(network);
    const priceFeedContract = new ethers.Contract(
      feedAddress,
      PriceFeedABI,
      provider,
    ) as PriceFeedContract;

    let description = '';
    let priceDecimalsRaw: bigint;
    let rawRoundData: RawPriceFeedRoundData;

    try {
      [description, priceDecimalsRaw, rawRoundData] = await Promise.all([
        priceFeedContract.description({ blockTag }).catch(() => ''),
        priceFeedContract.decimals({ blockTag }),
        priceFeedContract.latestRoundData({ blockTag }),
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to read feed ${feedAddress} for ${assetSymbol} on ${date.toISOString().slice(0, 10)} block ${blockTag} network ${network}: ${message}`,
      );
    }

    const roundData = {
      roundId: rawRoundData.roundId ?? rawRoundData[0],
      answer: rawRoundData.answer ?? rawRoundData[1],
      startedAt: rawRoundData.startedAt ?? rawRoundData[2],
      updatedAt: rawRoundData.updatedAt ?? rawRoundData[3],
      answeredInRound: rawRoundData.answeredInRound ?? rawRoundData[4],
    };
    const price = Number(ethers.formatUnits(roundData.answer, Number(priceDecimalsRaw)));

    if (!Number.isFinite(price) || price <= 0) {
      throw new Error(`Invalid feed price ${price} for ${assetSymbol} using ${feedAddress}`);
    }

    const { kind, quoteSymbol } = this.classifyFeed(description);

    const snapshot = {
      address: feedAddress,
      description,
      kind,
      price,
      quoteSymbol,
    };

    this.snapshotCache.set(snapshotCacheKey, snapshot);
    return snapshot;
  }

  private async resolveConstantUsdPrice(request: FeedPriceRequest): Promise<number> {
    const { defaultQuoteFeedAddress, defaultQuoteSymbol, feedAddress } = request;

    if (
      defaultQuoteFeedAddress &&
      defaultQuoteFeedAddress.toLowerCase() !== feedAddress.toLowerCase()
    ) {
      return this.getUsdPrice({
        assetSymbol: defaultQuoteSymbol ?? request.assetSymbol,
        blockTag: request.blockTag,
        date: request.date,
        feedAddress: defaultQuoteFeedAddress,
        network: request.network,
        defaultQuoteSymbol,
      });
    }

    if (!defaultQuoteSymbol) {
      throw new Error(`Missing default quote symbol for constant feed ${feedAddress}`);
    }

    return this.quotePriceService.getUsdPrice({
      blockTag: request.blockTag,
      date: request.date,
      network: request.network,
      symbol: defaultQuoteSymbol,
    });
  }

  private resolveUnknownUsdPrice(request: FeedPriceRequest, snapshot: FeedSnapshot): number {
    if (
      request.defaultQuoteSymbol &&
      this.normalizeAssetKey(request.assetSymbol) ===
        this.normalizeAssetKey(request.defaultQuoteSymbol)
    ) {
      this.logger.warn(
        `Treating feed ${snapshot.address} with unrecognized description "${snapshot.description}" as direct USD for ${request.assetSymbol}`,
      );
      return snapshot.price;
    }

    throw new Error(
      `Unsupported feed description "${snapshot.description}" for ${request.assetSymbol} using ${snapshot.address}`,
    );
  }

  private classifyFeed(description: string): Pick<FeedSnapshot, 'kind' | 'quoteSymbol'> {
    const trimmedDescription = description.trim();
    if (!trimmedDescription) {
      return { kind: 'unknown', quoteSymbol: null };
    }

    if (/constant price feed/i.test(trimmedDescription)) {
      return { kind: 'constant', quoteSymbol: null };
    }

    const normalizedDescription = this.normalizeFeedDescription(trimmedDescription);

    const match = normalizedDescription.match(/^(.+?)\s*\/\s*(.+)$/);
    if (!match) {
      return { kind: 'unknown', quoteSymbol: null };
    }

    const quoteSymbol = this.normalizeQuoteSymbol(match[2] ?? '');
    if (!quoteSymbol) {
      return { kind: 'unknown', quoteSymbol: null };
    }

    if (this.isUsdQuote(quoteSymbol)) {
      return { kind: 'direct_usd', quoteSymbol: 'USD' };
    }

    return { kind: 'quoted', quoteSymbol };
  }

  private isUsdQuote(symbol: string): boolean {
    const normalizedSymbol = this.normalizeAssetKey(symbol);
    return USD_QUOTE_ALIASES.has(normalizedSymbol);
  }

  private normalizeFeedDescription(description: string): string {
    return description
      .replace(/^Calculated\s+/i, '')
      .replace(/\s+SVR Price Feed$/i, '')
      .replace(/\s+CAPO Price Feed$/i, '')
      .replace(/\s+price feed$/i, '')
      .replace(/\s+Price Feed$/i, '')
      .replace(/\s+Exchange Rate$/i, '')
      .trim();
  }

  private normalizeQuoteSymbol(symbol: string): string | null {
    const normalizedSymbol = symbol
      .replace(/\bCAPO\b/gi, ' ')
      .replace(/\bSVR\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return normalizedSymbol || null;
  }

  private normalizeAssetKey(symbol: string): string {
    return symbol.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  }

  private normalizeRequest(request: FeedPriceRequest): FeedPriceRequest {
    return {
      ...request,
      feedAddress: request.feedAddress.toLowerCase(),
      network: request.network.toLowerCase(),
    };
  }

  private getSnapshotCacheKey(request: FeedPriceRequest): string {
    return `${request.network}:${request.feedAddress}:${request.blockTag}`;
  }
}
