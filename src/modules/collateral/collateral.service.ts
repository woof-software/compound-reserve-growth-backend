import { Injectable, Logger } from '@nestjs/common';
import { ethers } from 'ethers';

import { ContractService } from '@/modules/contract/contract.service';
import { SourceService } from '@/modules/source/source.service';

import { CollateralAlgorithmService } from './collateral-algorithm.service';
import type { CollateralSearchOutput } from './types/collateral.types';

import { Algorithm } from '@/common/enum/algorithm.enum';

@Injectable()
export class CollateralService {
  private readonly logger = new Logger(CollateralService.name);
  private readonly assetMetadataCache = new Map<string, { symbol: string; decimals: number }>();

  constructor(
    private readonly sourceService: SourceService,
    private readonly contractService: ContractService,
    private readonly collateralAlgorithmService: CollateralAlgorithmService,
  ) {}

  public async searchMarketsV3(): Promise<CollateralSearchOutput> {
    const sources = await this.sourceService.listByAlgorithms([Algorithm.COMET]);
    if (!sources.length) {
      this.logger.warn('No COMET sources found.');
      return {
        generatedAt: new Date().toISOString(),
        sources: [],
        missingSources: [],
      };
    }

    this.logger.log(`Found ${sources.length} COMET sources. Starting collateral scan...`);

    const output: CollateralSearchOutput = {
      generatedAt: new Date().toISOString(),
      sources: [],
      missingSources: [],
    };

    for (const source of sources) {
      try {
        let creationBlock: number;
        try {
          creationBlock = await this.contractService.getContractCreationBlock(
            source.address,
            source.network,
          );
        } catch (error) {
          this.logger.warn(
            `Failed to resolve creation block for ${source.network}/${source.address}. Using source.startBlock=${source.startBlock}`,
          );
          creationBlock = source.startBlock;
        }

        const lifecycle = await this.collateralAlgorithmService.cometCollateralLifecycle(
          source.network,
          source.address,
          creationBlock,
        );

        const collaterals = await Promise.all(
          lifecycle.assets
            .map((entry) => {
              const normalized = this.toChecksum(entry.asset);
              if (!normalized) {
                return null;
              }
              return { ...entry, asset: normalized };
            })
            .filter((entry) => entry !== null)
            .map(async (entry) => ({
              ...entry,
              ...(await this.getCollateralAssetMetadata(source.network, entry.asset)),
            })),
        );

        const collateralSet = new Set<string>();
        for (const entry of collaterals) {
          this.addNormalizedAddress(collateralSet, entry.asset);
        }

        const collateralAddresses = this.finalizeAddresses(collateralSet);
        this.logger.log(
          `Collected ${collaterals.length} collateral assets for ${source.network}/${source.market ?? source.address}`,
        );

        output.sources.push({
          sourceId: source.id,
          network: source.network,
          market: source.market ?? null,
          cometAddress: this.toChecksum(source.address) ?? source.address,
          fromBlock: lifecycle.fromBlock,
          toBlock: lifecycle.toBlock,
          collaterals,
          collateralAddresses,
        });
      } catch (error) {
        const reason = `Failed to scan comet collateral lifecycle for ${source.network}/${source.address}`;
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`${reason}: ${message}`);
        output.missingSources.push({
          sourceId: source.id,
          network: source.network,
          cometAddress: source.address,
          reason: `${reason}: ${message}`,
        });
      }
    }

    output.sources.sort((a, b) => {
      if (a.network !== b.network) return a.network.localeCompare(b.network);
      return (a.market ?? a.cometAddress).localeCompare(b.market ?? b.cometAddress);
    });
    output.missingSources.sort((a, b) => {
      if (a.network !== b.network) return a.network.localeCompare(b.network);
      return a.cometAddress.localeCompare(b.cometAddress);
    });

    return output;
  }

  private addNormalizedAddress(set: Set<string>, address: string): void {
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

  private async getCollateralAssetMetadata(
    network: string,
    assetAddress: string,
  ): Promise<{ symbol: string; decimals: number }> {
    const cacheKey = `${network}:${assetAddress.toLowerCase()}`;
    const cached = this.assetMetadataCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const metadata = await this.contractService.getTokenMetadata(assetAddress, network);

    this.assetMetadataCache.set(cacheKey, metadata);
    return metadata;
  }
}
