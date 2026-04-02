import { Injectable } from '@nestjs/common';
import { ethers } from 'ethers';

import {
  CometCollateralContract,
  CometAssetInfo,
  TokenMetadataContract,
} from './type/collateral-price-contract.type';
import { BaseTokenMetadataContext } from './type/base-token-metadata-context.type';
import { CollateralHistoricalPriceArgs } from './type/collateral-historical-price-args.type';
import { FeedPriceRequest } from './type/feed-price.type';
import { FeedPriceService } from './feed-price.service';

import { ProviderFactory } from '@/common/chains/network/provider.factory';
import CometABI from '@/modules/contract/abi/CometABI.json';
import ERC20ABI from '@/modules/contract/abi/ERC20ABI.json';

@Injectable()
export class CollateralPriceService {
  constructor(
    private readonly providerFactory: ProviderFactory,
    private readonly feedPriceService: FeedPriceService,
  ) {}

  async getPrice(request: CollateralHistoricalPriceArgs): Promise<number> {
    const { assetAddress, assetSymbol, blockTag, cometAddress, date, network } = request;

    const provider = this.providerFactory.multicall(network);
    const cometContract = new ethers.Contract(
      cometAddress,
      CometABI,
      provider,
    ) as CometCollateralContract;

    let assetInfo: CometAssetInfo;
    let baseTokenPriceFeed: string;
    try {
      [assetInfo, baseTokenPriceFeed] = await Promise.all([
        cometContract.getAssetInfoByAddress(assetAddress, { blockTag }),
        cometContract.baseTokenPriceFeed({ blockTag }),
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to read collateral asset info for ${assetSymbol} on ${date.toISOString().slice(0, 10)} block ${blockTag} network ${network}: ${message}`,
      );
    }

    if (!assetInfo?.priceFeed) {
      throw new Error(`No price feed configured for collateral ${assetSymbol}`);
    }

    const feedRequest: FeedPriceRequest = {
      assetSymbol,
      blockTag,
      date,
      feedAddress: assetInfo.priceFeed,
      network,
      defaultQuoteFeedAddress: baseTokenPriceFeed,
    };

    const snapshot = await this.feedPriceService.readFeed(feedRequest);

    if (snapshot.kind === 'constant' || snapshot.kind === 'unknown') {
      feedRequest.defaultQuoteSymbol = await this.getBaseTokenSymbol({
        assetSymbol,
        blockTag,
        cometContract,
        date,
        network,
        provider,
      });
    }

    return this.feedPriceService.resolveUsdPrice(feedRequest, snapshot);
  }

  private async getBaseTokenSymbol(request: BaseTokenMetadataContext): Promise<string> {
    const { assetSymbol, blockTag, cometContract, date, network, provider } = request;
    let baseTokenAddress: string;
    try {
      baseTokenAddress = await cometContract.baseToken({ blockTag });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to read base token address for ${assetSymbol} on ${date.toISOString().slice(0, 10)} block ${blockTag} network ${network}: ${message}`,
      );
    }

    const baseTokenContract = new ethers.Contract(
      baseTokenAddress,
      ERC20ABI,
      provider,
    ) as TokenMetadataContract;

    try {
      return await baseTokenContract.symbol({ blockTag });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to read base token metadata for ${assetSymbol} on ${date.toISOString().slice(0, 10)} block ${blockTag} network ${network}: ${message}`,
      );
    }
  }
}
