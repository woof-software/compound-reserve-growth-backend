import { writeFileSync } from 'fs';
import { resolve } from 'path';

import { Injectable, Logger } from '@nestjs/common';
import { ethers } from 'ethers';

import { ContractService } from 'modules/contract/contract.service';
import { SourceService } from 'modules/source/source.service';

import { CollateralAlgorithmService } from './collateral-algorithm.service';
import type { CollateralLifecycleEntry, CollateralSearchOutput } from './types/collateral.types';

import { Algorithm } from '@/common/enum/algorithm.enum';

@Injectable()
export class CollateralService {
  private readonly logger = new Logger(CollateralService.name);
  private readonly outputFile = 'collateral-markets-v3.json';

  constructor(
    private readonly sourceService: SourceService,
    private readonly contractService: ContractService,
    private readonly collateralAlgorithmService: CollateralAlgorithmService,
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
      try {
        let creationBlock: number;
        try {
          creationBlock = await this.contractService.getContractCreationBlock(
            source.address,
            source.network,
          );
        } catch (error) {
          this.logger.warn(
            `Failed to resolve creation block for ${source.network}/${source.address}. Using source.blockNumber=${source.blockNumber}`,
          );
          creationBlock = source.blockNumber;
        }

        const lifecycle = await this.collateralAlgorithmService.cometCollateralLifecycle(
          source.network,
          source.address,
          creationBlock,
        );

        const collaterals = lifecycle.assets
          .map((entry): CollateralLifecycleEntry | null => {
            const normalized = this.toChecksum(entry.asset);
            if (!normalized) {
              return null;
            }
            return { ...entry, asset: normalized };
          })
          .filter((entry): entry is CollateralLifecycleEntry => entry !== null);

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
        this.logger.error(reason, error);
        output.missingSources.push({
          sourceId: source.id,
          network: source.network,
          cometAddress: source.address,
          reason,
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

    const outputPath = resolve(process.cwd(), this.outputFile);
    writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
    this.logger.log(`Collateral list saved to ${outputPath}`);
    return;
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
