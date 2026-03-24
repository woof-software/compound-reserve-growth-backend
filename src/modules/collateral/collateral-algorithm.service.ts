import { Injectable, Logger } from '@nestjs/common';
import { ethers } from 'ethers';

import CometABI from 'modules/contract/abi/CometABI.json';
import type {
  CollateralLifecycleOutput,
  CometAssetInfo,
  CometContract,
  CometContractReaders,
} from 'modules/collateral/types/collateral.types';

import { BlockService } from 'common/chains/block/block.service';
import { ProviderFactory } from 'common/chains/network/provider.factory';

@Injectable()
export class CollateralAlgorithmService {
  private readonly logger = new Logger(CollateralAlgorithmService.name);
  private readonly READABLE_BLOCK_SEARCH_MAX_ITERATIONS = 30;
  private readonly DEACTIVATED_SUPPLY_CAP = 0n;
  private readonly EMPTY_COLLATERAL_RESERVES = 0n;

  constructor(
    private readonly providerFactory: ProviderFactory,
    private readonly blockService: BlockService,
  ) {}

  public async cometCollateralLifecycle(
    network: string,
    cometAddress: string,
    fromBlock: number,
    toBlock?: number,
  ): Promise<CollateralLifecycleOutput> {
    const { contract, directContract } = this.createCometContractReaders(network, cometAddress);
    const resolvedToBlock = await this.resolveToBlock(network, toBlock);
    this.validateBlockRange(fromBlock, resolvedToBlock);

    const readableFromBlock = await this.findFirstReadableBlock(
      directContract,
      fromBlock,
      resolvedToBlock,
    );
    const numAssets = await this.getNumAssetsAtBlock(contract, directContract, resolvedToBlock);

    if (numAssets <= 0) {
      return {
        network,
        cometAddress,
        fromBlock: readableFromBlock,
        toBlock: resolvedToBlock,
        generatedAt: new Date().toISOString(),
        assets: [],
      };
    }

    const assetIndices = this.createAssetIndices(numAssets);
    const latestAssetInfos = await this.loadAssetInfos(
      contract,
      directContract,
      assetIndices,
      resolvedToBlock,
    );
    const latestCollateralReserves = await this.loadCollateralReserves(
      contract,
      directContract,
      latestAssetInfos.map((info) => info.asset),
      resolvedToBlock,
    );
    const latestDeactivatedFlags = latestAssetInfos.map((info, position) =>
      this.isDeactivated(info, latestCollateralReserves[position]),
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
      latestAssetInfos.map((info) => info.asset),
      appearanceBlocks,
      resolvedToBlock,
      latestDeactivatedFlags,
    );

    const assets: CollateralLifecycleOutput['assets'] = assetIndices.map((index, position) => ({
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
    return this.loadWithDirectFallback(
      'getAssetInfo',
      indices.map((index) => contract.getAssetInfo(index, { blockTag })),
      () => indices.map((index) => directContract.getAssetInfo(index, { blockTag })),
    );
  }

  private async loadCollateralReserves(
    contract: CometContract,
    directContract: CometContract,
    assetAddresses: string[],
    blockTag: number,
  ): Promise<bigint[]> {
    return this.loadWithDirectFallback(
      'getCollateralReserves',
      assetAddresses.map((assetAddress) =>
        contract.getCollateralReserves(assetAddress, { blockTag }),
      ),
      () =>
        assetAddresses.map((assetAddress) =>
          directContract.getCollateralReserves(assetAddress, { blockTag }),
        ),
    );
  }

  private isDeactivated(assetInfo: CometAssetInfo, collateralReserves: bigint): boolean {
    return (
      assetInfo.supplyCap === this.DEACTIVATED_SUPPLY_CAP &&
      collateralReserves === this.EMPTY_COLLATERAL_RESERVES
    );
  }

  private groupPositionsByMid(
    pendingPositions: Set<number>,
    left: number[],
    right: number[],
  ): Map<number, number[]> {
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

    return midToPositions;
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
      const midToPositions = this.groupPositionsByMid(pendingPositions, left, right);

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
    assetAddresses: string[],
    appearanceBlocks: number[],
    toBlock: number,
    latestDeactivatedFlags: boolean[],
  ): Promise<Array<number | null>> {
    const deactivation = indices.map(() => null as number | null);
    const left = indices.map((_, position) => appearanceBlocks[position]);
    const right = indices.map(() => toBlock);
    const pendingPositions = new Set<number>();
    const assetInfoCache = new Map<string, CometAssetInfo>();
    const collateralReservesCache = new Map<string, bigint>();

    for (let position = 0; position < indices.length; position += 1) {
      if (latestDeactivatedFlags[position]) {
        pendingPositions.add(position);
      }
    }

    while (pendingPositions.size > 0) {
      const midToPositions = this.groupPositionsByMid(pendingPositions, left, right);

      const assetInfoCalls: Array<Promise<CometAssetInfo>> = [];
      const assetInfoCallMetadata: Array<{ key: string; index: number; blockTag: number }> = [];
      const collateralReserveCalls: Array<Promise<bigint>> = [];
      const collateralReserveCallMetadata: Array<{
        key: string;
        assetAddress: string;
        blockTag: number;
      }> = [];

      for (const [mid, positions] of midToPositions) {
        for (const position of positions) {
          const index = indices[position];
          const key = `${mid}:${index}`;
          if (!assetInfoCache.has(key)) {
            assetInfoCalls.push(contract.getAssetInfo(index, { blockTag: mid }));
            assetInfoCallMetadata.push({ key, index, blockTag: mid });
          }
          if (!collateralReservesCache.has(key)) {
            collateralReserveCalls.push(
              contract.getCollateralReserves(assetAddresses[position], { blockTag: mid }),
            );
            collateralReserveCallMetadata.push({
              key,
              assetAddress: assetAddresses[position],
              blockTag: mid,
            });
          }
        }
      }

      if (assetInfoCalls.length > 0) {
        const results = await this.loadWithDirectFallback('getAssetInfo', assetInfoCalls, () =>
          assetInfoCallMetadata.map(({ index, blockTag }) =>
            directContract.getAssetInfo(index, { blockTag }),
          ),
        );
        for (let i = 0; i < results.length; i += 1) {
          const { key } = assetInfoCallMetadata[i];
          assetInfoCache.set(key, results[i]);
        }
      }

      if (collateralReserveCalls.length > 0) {
        const results = await this.loadWithDirectFallback(
          'getCollateralReserves',
          collateralReserveCalls,
          () =>
            collateralReserveCallMetadata.map(({ assetAddress, blockTag }) =>
              directContract.getCollateralReserves(assetAddress, { blockTag }),
            ),
        );
        for (let i = 0; i < results.length; i += 1) {
          const { key } = collateralReserveCallMetadata[i];
          collateralReservesCache.set(key, results[i]);
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
          const collateralReserves = collateralReservesCache.get(key);
          if (typeof collateralReserves === 'undefined') {
            throw new Error(`Missing collateral reserves for index ${index} at block ${mid}`);
          }

          const isDeactivated = this.isDeactivated(assetInfo, collateralReserves);

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
    const results = await this.loadWithDirectFallback(
      'numAssets',
      blockTags.map((blockTag) => contract.numAssets({ blockTag })),
      () => blockTags.map((blockTag) => directContract.numAssets({ blockTag })),
    );
    const map = new Map<number, number>();
    for (let i = 0; i < blockTags.length; i += 1) {
      map.set(blockTags[i], this.toFiniteNumber(results[i], `numAssets at block ${blockTags[i]}`));
    }
    return map;
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

    while (left <= right && iterations < this.READABLE_BLOCK_SEARCH_MAX_ITERATIONS) {
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
      const numAssets = this.toFiniteNumber(value, `numAssets at block ${blockTag}`);
      return Number.isFinite(numAssets);
    } catch {
      return false;
    }
  }

  private createCometContractReaders(network: string, cometAddress: string): CometContractReaders {
    const provider = this.providerFactory.get(network);
    const multicallProvider = this.providerFactory.multicall(network);

    return {
      contract: new ethers.Contract(
        cometAddress,
        CometABI,
        multicallProvider,
      ) as unknown as CometContract,
      directContract: new ethers.Contract(
        cometAddress,
        CometABI,
        provider,
      ) as unknown as CometContract,
    };
  }

  private async resolveToBlock(network: string, toBlock?: number): Promise<number> {
    return typeof toBlock === 'number' ? toBlock : this.blockService.getSafeBlockNumber(network);
  }

  private validateBlockRange(fromBlock: number, toBlock: number): void {
    if (!Number.isFinite(fromBlock) || fromBlock < 0) {
      throw new Error(`Invalid fromBlock: ${fromBlock}`);
    }

    if (!Number.isFinite(toBlock) || toBlock < fromBlock) {
      throw new Error(`Invalid toBlock: ${toBlock}`);
    }
  }

  private createAssetIndices(numAssets: number): number[] {
    return Array.from({ length: numAssets }, (_, index) => index);
  }

  private async getNumAssetsAtBlock(
    contract: CometContract,
    directContract: CometContract,
    blockTag: number,
  ): Promise<number> {
    const numAssetsByBlock = await this.loadNumAssets(contract, directContract, [blockTag]);
    const numAssets = numAssetsByBlock.get(blockTag);

    if (typeof numAssets !== 'number') {
      throw new Error(`Missing numAssets for block ${blockTag}`);
    }

    return numAssets;
  }

  private async loadWithDirectFallback<T>(
    operationName: string,
    primaryCalls: Array<Promise<T>>,
    fallbackCallsFactory: () => Array<Promise<T>>,
  ): Promise<T[]> {
    try {
      return await Promise.all(primaryCalls);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Multicall ${operationName} failed. Falling back to direct RPC calls. Error: ${message}`,
      );
      return Promise.all(fallbackCallsFactory());
    }
  }

  private toFiniteNumber(value: bigint, context: string): number {
    const normalized = Number(value);
    if (!Number.isFinite(normalized)) {
      throw new Error(`Invalid ${context}`);
    }
    return normalized;
  }
}
