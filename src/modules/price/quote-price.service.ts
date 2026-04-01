import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';

import WstEthABI from 'modules/contract/abi/WstEthABI.json';

import {
  BTC_QUOTE_ALIASES,
  ETH_QUOTE_ALIASES,
  RON_QUOTE_ALIASES,
  USD_QUOTE_ALIASES,
  WSTETH_QUOTE_ALIASES,
} from './constants';
import { PriceFeedContract, RawPriceFeedRoundData } from './type/collateral-price-contract.type';
import { CanonicalQuoteSymbol, QuotePriceRequest, WstEthContract } from './type/quote-price.type';

import { BlockService } from '@/common/chains/block/block.service';
import { ProviderFactory } from '@/common/chains/network/provider.factory';
import { PriceOnChainConfig } from '@/config/price-on-chain.config';
import PriceFeedABI from '@/modules/contract/abi/PriceFeedABI.json';

@Injectable()
export class QuotePriceService {
  private readonly logger = new Logger(QuotePriceService.name);
  private readonly blockTagCache = new Map<string, number>();
  private readonly priceCache = new Map<string, number>();

  constructor(
    private readonly configService: ConfigService,
    private readonly providerFactory: ProviderFactory,
    private readonly blockService: BlockService,
  ) {}

  private get priceOnChain(): PriceOnChainConfig {
    return this.configService.getOrThrow<PriceOnChainConfig>('priceOnChain');
  }

  async getUsdPrice({ blockTag, date, network, symbol }: QuotePriceRequest): Promise<number> {
    const canonicalSymbol = this.canonicalizeQuoteSymbol(symbol);

    switch (canonicalSymbol) {
      case 'ETH':
      case 'BTC':
      case 'RON':
        return this.getStandardFeedUsdPrice(canonicalSymbol, network, date, blockTag);
      case 'wstETH':
        return this.getWstEthUsdPrice(network, date, blockTag);
      default:
        throw new Error(`Unsupported quote asset for USD resolution: ${symbol}`);
    }
  }

  private async getStandardFeedUsdPrice(
    symbol: Exclude<CanonicalQuoteSymbol, 'USD' | 'wstETH'>,
    network: string,
    date: Date,
    blockTag: number,
  ): Promise<number> {
    const configuredFeedNetworks = this.priceOnChain.quoteUsdFeeds[symbol];
    const feedNetwork =
      network in configuredFeedNetworks
        ? network
        : this.priceOnChain.quoteFeedFallbackNetwork[
            symbol as keyof typeof this.priceOnChain.quoteFeedFallbackNetwork
          ];

    if (!feedNetwork) {
      throw new Error(`No on-chain USD feed configured for ${symbol} on network ${network}`);
    }

    const feedAddress = configuredFeedNetworks[feedNetwork];
    if (!feedAddress) {
      throw new Error(`Missing feed address for ${symbol} on network ${feedNetwork}`);
    }

    const resolvedBlockTag = await this.resolveBlockTag(feedNetwork, network, date, blockTag);
    const cacheKey = `${symbol}:${feedNetwork}:${resolvedBlockTag}`;
    const cachedPrice = this.priceCache.get(cacheKey);
    if (cachedPrice) {
      return cachedPrice;
    }

    const provider = this.providerFactory.multicall(feedNetwork);
    const priceFeedContract = new ethers.Contract(
      feedAddress,
      PriceFeedABI,
      provider,
    ) as PriceFeedContract;

    const [priceDecimalsRaw, rawRoundData] = await Promise.all([
      priceFeedContract.decimals({ blockTag: resolvedBlockTag }),
      priceFeedContract.latestRoundData({ blockTag: resolvedBlockTag }),
    ]);

    const roundData = this.mapRoundData(rawRoundData);
    const price = Number(ethers.formatUnits(roundData.answer, Number(priceDecimalsRaw)));

    if (!Number.isFinite(price) || price <= 0) {
      throw new Error(`Invalid USD price ${price} for ${symbol} on ${feedNetwork}`);
    }

    this.priceCache.set(cacheKey, price);
    return price;
  }

  private async getWstEthUsdPrice(network: string, date: Date, blockTag: number): Promise<number> {
    const mainnetBlockTag = await this.resolveBlockTag('mainnet', network, date, blockTag);
    const cacheKey = `wstETH:mainnet:${mainnetBlockTag}`;
    const cachedPrice = this.priceCache.get(cacheKey);
    if (cachedPrice) {
      return cachedPrice;
    }

    const provider = this.providerFactory.multicall('mainnet');
    const wstEthContract = new ethers.Contract(
      this.priceOnChain.wstEth.mainnetAddress,
      WstEthABI,
      provider,
    ) as WstEthContract;

    const [stEthPerTokenRaw, ethUsdPrice] = await Promise.all([
      wstEthContract.stEthPerToken({ blockTag: mainnetBlockTag }),
      this.getStandardFeedUsdPrice('ETH', 'mainnet', date, mainnetBlockTag),
    ]);

    const stEthPerToken = Number(ethers.formatUnits(stEthPerTokenRaw, 18));
    const price = stEthPerToken * ethUsdPrice;

    if (!Number.isFinite(price) || price <= 0) {
      throw new Error(`Invalid USD price ${price} for wstETH on mainnet`);
    }

    this.priceCache.set(cacheKey, price);
    return price;
  }

  private async resolveBlockTag(
    feedNetwork: string,
    requestNetwork: string,
    date: Date,
    blockTag: number,
  ): Promise<number> {
    if (feedNetwork === requestNetwork) {
      return blockTag;
    }

    const cacheKey = `${feedNetwork}:${date.toISOString().slice(0, 10)}`;
    const cachedBlockTag = this.blockTagCache.get(cacheKey);
    if (cachedBlockTag) {
      return cachedBlockTag;
    }

    const provider = this.providerFactory.multicall(feedNetwork);
    const targetTimestamp = Math.floor(date.getTime() / 1000);
    const resolvedBlockTag = await this.blockService.findBlockByTimestamp(
      feedNetwork,
      provider,
      targetTimestamp,
    );

    this.blockTagCache.set(cacheKey, resolvedBlockTag);
    return resolvedBlockTag;
  }

  private canonicalizeQuoteSymbol(symbol: string): CanonicalQuoteSymbol {
    const normalizedSymbol = symbol.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

    if (USD_QUOTE_ALIASES.has(normalizedSymbol)) {
      return 'USD';
    }

    if (ETH_QUOTE_ALIASES.has(normalizedSymbol)) {
      return 'ETH';
    }

    if (BTC_QUOTE_ALIASES.has(normalizedSymbol)) {
      return 'BTC';
    }

    if (WSTETH_QUOTE_ALIASES.has(normalizedSymbol)) {
      return 'wstETH';
    }

    if (RON_QUOTE_ALIASES.has(normalizedSymbol)) {
      return 'RON';
    }

    this.logger.debug(`Unknown quote symbol encountered: ${symbol}`);
    throw new Error(`Unsupported quote asset for USD resolution: ${symbol}`);
  }

  private mapRoundData(rawRoundData: RawPriceFeedRoundData) {
    return {
      roundId: rawRoundData.roundId ?? rawRoundData[0],
      answer: rawRoundData.answer ?? rawRoundData[1],
      startedAt: rawRoundData.startedAt ?? rawRoundData[2],
      updatedAt: rawRoundData.updatedAt ?? rawRoundData[3],
      answeredInRound: rawRoundData.answeredInRound ?? rawRoundData[4],
    };
  }
}
