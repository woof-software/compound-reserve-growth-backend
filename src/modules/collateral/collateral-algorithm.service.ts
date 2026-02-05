import { Injectable } from '@nestjs/common';
import { ethers } from 'ethers';

import CometABI from 'modules/contract/abi/CometABI.json';
import { ProviderFactory } from 'modules/network/provider.factory';
import type {
  CollateralLifecycleEntry,
  CollateralLifecycleOutput,
  CometAssetInfo,
  CometContract,
} from 'modules/collateral/types/collateral.types';

@Injectable()
export class CollateralAlgorithmService {
  constructor(private readonly providerFactory: ProviderFactory) {}

  public async cometCollateralLifecycle(
    network: string,
    cometAddress: string,
    fromBlock: number,
    toBlock?: number,
  ): Promise<CollateralLifecycleOutput> {
    const provider = this.providerFactory.get(network);
    const multicallProvider = this.providerFactory.multicall(network);
    const contract = new ethers.Contract(
      cometAddress,
      CometABI,
      multicallProvider,
    ) as unknown as CometContract;
    const directContract = new ethers.Contract(
      cometAddress,
      CometABI,
      provider,
    ) as unknown as CometContract;

    const resolvedToBlock = typeof toBlock === 'number' ? toBlock : await provider.getBlockNumber();

    if (!Number.isFinite(fromBlock) || fromBlock < 0) {
      throw new Error(`Invalid fromBlock: ${fromBlock}`);
    }
    if (!Number.isFinite(resolvedToBlock) || resolvedToBlock < fromBlock) {
      throw new Error(`Invalid toBlock: ${resolvedToBlock}`);
    }

    const readableFromBlock = await this.findFirstReadableBlock(
      directContract,
      fromBlock,
      resolvedToBlock,
    );
    const numAssetsRaw = await directContract.numAssets({ blockTag: resolvedToBlock });
    const numAssets = Number(numAssetsRaw);

    if (!Number.isFinite(numAssets) || numAssets <= 0) {
      return {
        network,
        cometAddress,
        fromBlock: readableFromBlock,
        toBlock: resolvedToBlock,
        generatedAt: new Date().toISOString(),
        assets: [],
      };
    }

    const assetIndices = Array.from({ length: numAssets }, (_, index) => index);
    const latestAssetInfos = await this.loadAssetInfos(
      contract,
      directContract,
      assetIndices,
      resolvedToBlock,
    );
    const latestDeactivatedFlags = await this.resolvePriceFeedDeactivationFlags(
      contract,
      directContract,
      latestAssetInfos,
      resolvedToBlock,
    );

    const appearanceBlocks = await this.findAppearanceBlocks(
      contract,
      directContract,
      assetIndices,
      readableFromBlock,
      resolvedToBlock,
    );

    const deactivationBlocks = await this.findDeactivationBlocks(
      contract,
      directContract,
      assetIndices,
      appearanceBlocks,
      resolvedToBlock,
      latestAssetInfos,
      latestDeactivatedFlags,
    );

    const assets: CollateralLifecycleEntry[] = assetIndices.map((index, position) => ({
      index,
      asset: latestAssetInfos[position]?.asset ?? '',
      appearanceBlock: appearanceBlocks[position],
      deactivationBlock: deactivationBlocks[position],
    }));

    return {
      network,
      cometAddress,
      fromBlock: readableFromBlock,
      toBlock: resolvedToBlock,
      generatedAt: new Date().toISOString(),
      assets,
    };
  }

  private async loadAssetInfos(
    contract: CometContract,
    directContract: CometContract,
    indices: number[],
    blockTag: number,
  ): Promise<CometAssetInfo[]> {
    const calls = indices.map((index) => contract.getAssetInfo(index, { blockTag }));
    try {
      return await Promise.all(calls);
    } catch {
      const fallbackCalls = indices.map((index) =>
        directContract.getAssetInfo(index, { blockTag }),
      );
      return Promise.all(fallbackCalls);
    }
  }

  private isPriceFeedDeactivated(priceFeed: string, priceValue: bigint | null): boolean {
    return priceFeed === ethers.ZeroAddress || priceValue === null || priceValue === 0n;
  }

  private async findAppearanceBlocks(
    contract: CometContract,
    directContract: CometContract,
    indices: number[],
    fromBlock: number,
    toBlock: number,
  ): Promise<number[]> {
    const left = indices.map(() => fromBlock);
    const right = indices.map(() => toBlock);
    const appearance = indices.map(() => toBlock);
    const pendingPositions = new Set<number>(indices.map((_, position) => position));
    const numAssetsCache = new Map<number, number>();

    while (pendingPositions.size > 0) {
      const midToPositions = new Map<number, number[]>();

      for (const position of pendingPositions) {
        const mid = Math.floor((left[position] + right[position]) / 2);
        const bucket = midToPositions.get(mid);
        if (bucket) {
          bucket.push(position);
        } else {
          midToPositions.set(mid, [position]);
        }
      }

      const mids = Array.from(midToPositions.keys());
      const unresolvedMids = mids.filter((mid) => !numAssetsCache.has(mid));
      if (unresolvedMids.length > 0) {
        const numAssetsByBlock = await this.loadNumAssets(contract, directContract, unresolvedMids);
        for (const [block, numAssets] of numAssetsByBlock) {
          numAssetsCache.set(block, numAssets);
        }
      }

      for (const [mid, positions] of midToPositions) {
        const numAssetsAtMid = numAssetsCache.get(mid);
        if (typeof numAssetsAtMid !== 'number') {
          throw new Error(`Missing numAssets for block ${mid}`);
        }

        for (const position of positions) {
          const targetCount = indices[position] + 1;
          if (numAssetsAtMid >= targetCount) {
            right[position] = mid;
          } else {
            left[position] = mid + 1;
          }

          if (left[position] >= right[position]) {
            appearance[position] = left[position];
            pendingPositions.delete(position);
          }
        }
      }
    }

    return appearance;
  }

  private async findDeactivationBlocks(
    contract: CometContract,
    directContract: CometContract,
    indices: number[],
    appearanceBlocks: number[],
    toBlock: number,
    latestAssetInfos: CometAssetInfo[],
    latestDeactivatedFlags: boolean[],
  ): Promise<Array<number | null>> {
    const deactivation = indices.map(() => null as number | null);
    const left = indices.map((_, position) => appearanceBlocks[position]);
    const right = indices.map(() => toBlock);
    const pendingPositions = new Set<number>();
    const assetInfoCache = new Map<string, CometAssetInfo>();
    const priceCache = new Map<string, bigint | null>();

    for (let position = 0; position < indices.length; position += 1) {
      if (latestDeactivatedFlags[position]) {
        pendingPositions.add(position);
      }
    }

    while (pendingPositions.size > 0) {
      const midToPositions = new Map<number, number[]>();

      for (const position of pendingPositions) {
        const mid = Math.floor((left[position] + right[position]) / 2);
        const bucket = midToPositions.get(mid);
        if (bucket) {
          bucket.push(position);
        } else {
          midToPositions.set(mid, [position]);
        }
      }

      const calls: Array<Promise<CometAssetInfo>> = [];
      const callMetadata: Array<{ key: string; index: number; blockTag: number }> = [];

      for (const [mid, positions] of midToPositions) {
        for (const position of positions) {
          const index = indices[position];
          const key = `${mid}:${index}`;
          if (assetInfoCache.has(key)) {
            continue;
          }
          calls.push(contract.getAssetInfo(index, { blockTag: mid }));
          callMetadata.push({ key, index, blockTag: mid });
        }
      }

      if (calls.length > 0) {
        let results: CometAssetInfo[];
        try {
          results = await Promise.all(calls);
        } catch {
          const fallbackCalls = callMetadata.map(({ index, blockTag }) =>
            directContract.getAssetInfo(index, { blockTag }),
          );
          results = await Promise.all(fallbackCalls);
        }
        for (let i = 0; i < results.length; i += 1) {
          const { key } = callMetadata[i];
          assetInfoCache.set(key, results[i]);
        }
      }

      const priceRequests: Array<{ key: string; priceFeed: string; blockTag: number }> = [];
      for (const [mid, positions] of midToPositions) {
        for (const position of positions) {
          const index = indices[position];
          const assetKey = `${mid}:${index}`;
          const assetInfo = assetInfoCache.get(assetKey);
          if (!assetInfo) {
            continue;
          }
          const priceFeed = assetInfo.priceFeed;
          if (priceFeed === ethers.ZeroAddress) {
            continue;
          }
          const priceKey = `${mid}:${priceFeed}`;
          if (!priceCache.has(priceKey)) {
            priceRequests.push({ key: priceKey, priceFeed, blockTag: mid });
          }
        }
      }

      if (priceRequests.length > 0) {
        const priceResults = await this.loadPrices(contract, directContract, priceRequests);
        for (const [key, price] of priceResults) {
          priceCache.set(key, price);
        }
      }

      for (const [mid, positions] of midToPositions) {
        for (const position of positions) {
          const index = indices[position];
          const key = `${mid}:${index}`;
          const assetInfo = assetInfoCache.get(key);
          if (!assetInfo) {
            throw new Error(`Missing asset info for index ${index} at block ${mid}`);
          }

          const priceKey = `${mid}:${assetInfo.priceFeed}`;
          const priceValue =
            assetInfo.priceFeed === ethers.ZeroAddress ? null : (priceCache.get(priceKey) ?? null);
          const isDeactivated = this.isPriceFeedDeactivated(assetInfo.priceFeed, priceValue);

          if (isDeactivated) {
            right[position] = mid;
          } else {
            left[position] = mid + 1;
          }

          if (left[position] >= right[position]) {
            deactivation[position] = left[position];
            pendingPositions.delete(position);
          }
        }
      }
    }

    return deactivation;
  }

  private async loadNumAssets(
    contract: CometContract,
    directContract: CometContract,
    blockTags: number[],
  ): Promise<Map<number, number>> {
    const calls = blockTags.map((blockTag) => contract.numAssets({ blockTag }));
    let results: bigint[];
    try {
      results = await Promise.all(calls);
    } catch {
      const fallbackCalls = blockTags.map((blockTag) => directContract.numAssets({ blockTag }));
      results = await Promise.all(fallbackCalls);
    }
    const map = new Map<number, number>();
    for (let i = 0; i < blockTags.length; i += 1) {
      const value = Number(results[i]);
      if (!Number.isFinite(value)) {
        throw new Error(`Invalid numAssets at block ${blockTags[i]}`);
      }
      map.set(blockTags[i], value);
    }
    return map;
  }

  private async resolvePriceFeedDeactivationFlags(
    contract: CometContract,
    directContract: CometContract,
    assetInfos: CometAssetInfo[],
    blockTag: number,
  ): Promise<boolean[]> {
    const priceRequests: Array<{ key: string; priceFeed: string; blockTag: number }> = [];
    const priceKeys = assetInfos.map((info) => `${blockTag}:${info.priceFeed}`);

    for (const assetInfo of assetInfos) {
      if (assetInfo.priceFeed === ethers.ZeroAddress) {
        continue;
      }
      const priceKey = `${blockTag}:${assetInfo.priceFeed}`;
      priceRequests.push({ key: priceKey, priceFeed: assetInfo.priceFeed, blockTag });
    }

    const priceCache = new Map<string, bigint | null>();
    if (priceRequests.length > 0) {
      const priceResults = await this.loadPrices(contract, directContract, priceRequests);
      for (const [key, price] of priceResults) {
        priceCache.set(key, price);
      }
    }

    return assetInfos.map((info, index) => {
      const priceKey = priceKeys[index];
      const priceValue =
        info.priceFeed === ethers.ZeroAddress ? null : (priceCache.get(priceKey) ?? null);
      return this.isPriceFeedDeactivated(info.priceFeed, priceValue);
    });
  }

  private async loadPrices(
    contract: CometContract,
    directContract: CometContract,
    requests: Array<{ key: string; priceFeed: string; blockTag: number }>,
  ): Promise<Map<string, bigint | null>> {
    const results = new Map<string, bigint | null>();
    const calls = requests.map(({ priceFeed, blockTag }) =>
      contract.getPrice(priceFeed, { blockTag }),
    );

    try {
      const values = await Promise.all(calls);
      for (let i = 0; i < values.length; i += 1) {
        results.set(requests[i].key, values[i]);
      }
      return results;
    } catch {
      for (const { key, priceFeed, blockTag } of requests) {
        try {
          const value = await directContract.getPrice(priceFeed, { blockTag });
          results.set(key, value);
        } catch {
          results.set(key, null);
        }
      }
      return results;
    }
  }

  private async findFirstReadableBlock(
    directContract: CometContract,
    fromBlock: number,
    toBlock: number,
  ): Promise<number> {
    let left = fromBlock;
    let right = toBlock;
    let result = toBlock;
    let iterations = 0;

    while (left <= right && iterations < 30) {
      iterations += 1;
      const mid = Math.floor((left + right) / 2);
      const readable = await this.canReadNumAssets(directContract, mid);

      if (readable) {
        result = mid;
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    }

    if (!(await this.canReadNumAssets(directContract, result))) {
      throw new Error(`numAssets is unreadable from ${fromBlock} to ${toBlock}`);
    }

    return result;
  }

  private async canReadNumAssets(
    directContract: CometContract,
    blockTag: number,
  ): Promise<boolean> {
    try {
      const value = await directContract.numAssets({ blockTag });
      const numAssets = Number(value);
      return Number.isFinite(numAssets);
    } catch {
      return false;
    }
  }
}
