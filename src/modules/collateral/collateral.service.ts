import { writeFileSync } from 'fs';
import { resolve } from 'path';

import { Injectable, Logger } from '@nestjs/common';
import { ethers } from 'ethers';

import { ContractService } from 'modules/contract/contract.service';
import CometABI from 'modules/contract/abi/CometABI.json';
import { ProviderFactory } from 'modules/network/provider.factory';
import { SourceService } from 'modules/source/source.service';

import type { CollateralSearchOutput, CometContract } from './types/collateral.types';

import { Algorithm } from '@/common/enum/algorithm.enum';
import { SEVEN_DAYS_IN_SEC } from '@/common/constants';
import { calculateTimeRange } from '@/common/utils/calculate-time-range';

@Injectable()
export class CollateralService {
  private readonly logger = new Logger(CollateralService.name);
  private readonly outputFile = 'collateral-markets-v3.json';

  constructor(
    private readonly sourceService: SourceService,
    private readonly providerFactory: ProviderFactory,
    private readonly contractService: ContractService,
  ) {}

  public async searchMarketsV3() {
    const sources = await this.sourceService.listByAlgorithms([Algorithm.COMET]);
    if (!sources.length) {
      this.logger.warn('No COMET sources found.');
      return;
    }

    this.logger.log(`Found ${sources.length} COMET sources. Starting collateral scan...`);

    const output: CollateralSearchOutput = {
      generatedAt: new Date().toISOString(),
      sources: [],
      missingSources: [],
    };

    for (const source of sources) {
      const collateralSet = new Set<string>();

      try {
        const historical = await this.collectCollateralsByDailyScan(source.address, source.network);
        for (const address of historical) {
          this.addNormalizedAddress(collateralSet, address);
        }
      } catch (error) {
        const reason = `Failed to scan comet assets for ${source.network}/${source.address}`;
        this.logger.error(reason, error);
        output.missingSources.push({
          sourceId: source.id,
          network: source.network,
          cometAddress: source.address,
          reason,
        });
      }

      try {
        const current = await this.collectCurrentCollaterals(source.address, source.network);
        for (const address of current) {
          this.addNormalizedAddress(collateralSet, address);
        }
      } catch (error) {
        this.logger.error(
          `Failed to load current collaterals for ${source.network}/${source.address}:`,
          error,
        );
      }

      const collateralAddresses = this.finalizeAddresses(collateralSet);
      this.logger.log(
        `Collected ${collateralAddresses.length} collateral assets for ${source.network}/${source.market ?? source.address}`,
      );

      output.sources.push({
        sourceId: source.id,
        network: source.network,
        market: source.market ?? null,
        cometAddress: this.toChecksum(source.address) ?? source.address,
        collateralAddresses,
      });
    }

    output.sources.sort((a, b) => {
      if (a.network !== b.network) return a.network.localeCompare(b.network);
      return (a.market ?? a.cometAddress).localeCompare(b.market ?? b.cometAddress);
    });
    output.missingSources.sort((a, b) => {
      if (a.network !== b.network) return a.network.localeCompare(b.network);
      return a.cometAddress.localeCompare(b.cometAddress);
    });

    const outputPath = resolve(process.cwd(), this.outputFile);
    writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
    this.logger.log(`Collateral list saved to ${outputPath}`);
    return;
  }

  private async collectCollateralsByDailyScan(
    cometAddress: string,
    network: string,
  ): Promise<string[]> {
    const provider = this.providerFactory.get(network);
    const cometContract = new ethers.Contract(
      cometAddress,
      CometABI,
      provider,
    ) as unknown as CometContract;

    const creationBlock = await this.contractService.getContractCreationBlock(
      cometAddress,
      network,
    );
    const creationBlockData = await provider.getBlock(creationBlock);
    if (!creationBlockData) {
      throw new Error(`Creation block ${creationBlock} not found for ${cometAddress}`);
    }

    const assets = new Set<string>();
    let maxAssetsSeen = 0;
    let lastBlock = creationBlock;

    const addNewAssetsAtBlock = async (blockTag: number) => {
      try {
        const numAssetsRaw = await cometContract.numAssets({ blockTag });
        const numAssets = Number(numAssetsRaw);

        if (!Number.isFinite(numAssets) || numAssets <= maxAssetsSeen) {
          return;
        }

        const newIndices = Array.from(
          { length: numAssets - maxAssetsSeen },
          (_, index) => index + maxAssetsSeen,
        );
        const assetInfos = await Promise.all(
          newIndices.map((index) => cometContract.getAssetInfo(index, { blockTag })),
        );

        for (const assetInfo of assetInfos) {
          if (assetInfo?.asset) {
            this.addNormalizedAddress(assets, assetInfo.asset);
          }
        }

        maxAssetsSeen = numAssets;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Skipping numAssets scan for ${network}/${cometAddress} at block ${blockTag}: ${message}`,
        );
      }
    };

    await addNewAssetsAtBlock(creationBlock);

    const { firstMidnightUTC, todayMidnightUTC } = calculateTimeRange(creationBlockData.timestamp);
    for (
      let targetTs = firstMidnightUTC;
      targetTs <= todayMidnightUTC;
      targetTs += SEVEN_DAYS_IN_SEC
    ) {
      try {
        const blockTag = await this.contractService.findBlockByTimestamp(
          network,
          provider,
          targetTs,
          lastBlock,
        );
        lastBlock = blockTag;
        await addNewAssetsAtBlock(blockTag);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Skipping day ${new Date(targetTs * 1000).toISOString().slice(0, 10)} for ${network}/${cometAddress}: ${message}`,
        );
      }
    }

    return Array.from(assets);
  }

  private async collectCurrentCollaterals(
    cometAddress: string,
    network: string,
  ): Promise<string[]> {
    const provider = this.providerFactory.get(network);
    const cometContract = new ethers.Contract(
      cometAddress,
      CometABI,
      provider,
    ) as unknown as CometContract;

    const numAssetsRaw = await cometContract.numAssets();
    const numAssets = Number(numAssetsRaw);

    if (!Number.isFinite(numAssets) || numAssets <= 0) {
      return [];
    }

    const assetIndices = Array.from({ length: numAssets }, (_, index) => index);
    const assetInfos = await Promise.all(
      assetIndices.map((index) => cometContract.getAssetInfo(index)),
    );

    return assetInfos
      .map((assetInfo) => assetInfo?.asset)
      .filter((asset): asset is string => ethers.isAddress(asset));
  }

  private addNormalizedAddress(set: Set<string>, address: string) {
    const normalized = this.toChecksum(address);
    if (!normalized) return;
    set.add(normalized.toLowerCase());
  }

  private finalizeAddresses(set: Set<string>): string[] {
    return Array.from(set)
      .map((address) => this.toChecksum(address) ?? address)
      .sort((a, b) => a.localeCompare(b));
  }

  private toChecksum(address: string): string | null {
    if (!ethers.isAddress(address)) return null;
    return ethers.getAddress(address);
  }
}
