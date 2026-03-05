import { Injectable, Logger } from '@nestjs/common';
import { ethers } from 'ethers';

import CapoABI from 'modules/capo/abi/ERC4626CorrelatedAssetsPriceOracle.json';

import { ProviderFactory } from 'common/chains/network/provider.factory';

import { Oracle } from './oracle.entity';

import { OracleData } from '@/common/types/oracle-data';
import { CapoValues } from '@/common/types/capo-values';

@Injectable()
export class OracleService {
  private readonly logger = new Logger(OracleService.name);

  constructor(private readonly providerFactory: ProviderFactory) {}

  /**
   * Reads oracle state at a specific block so all fields are consistent and less sensitive to reorgs.
   * Caller must pass a lagged block number (e.g. value from BlockService.getSafeBlockNumber).
   */
  async getOracleData(oracle: Oracle, blockNumber: number): Promise<OracleData> {
    try {
      const provider = this.providerFactory.multicall(oracle.network);
      const oracleContract = new ethers.Contract(oracle.address, CapoABI, provider);
      const blockTag = blockNumber;

      const block = await provider.getBlock(blockTag);
      if (!block) {
        throw new Error(`Block ${blockNumber} not found`);
      }

      const [
        latestRoundData,
        ratio,
        isCapped,
        decimals,
        snapshotRatio,
        snapshotTimestamp,
        maxYearlyGrowthPercent,
      ] = await Promise.all([
        oracleContract.latestRoundData({ blockTag }),
        oracleContract.getRatio({ blockTag }),
        oracleContract.isCapped({ blockTag }),
        oracleContract.decimals({ blockTag }),
        oracleContract.snapshotRatio({ blockTag }),
        oracleContract.snapshotTimestamp({ blockTag }),
        oracleContract.maxYearlyRatioGrowthPercent({ blockTag }),
      ]);

      this.logger.debug(
        `Oracle data read via multicall oracle=${oracle.address} network=${oracle.network} block=${blockTag} batchedCalls=7`,
      );

      const price = latestRoundData.answer;
      return {
        ratio: ratio.toString(),
        price: ethers.formatUnits(price, decimals),
        snapshotRatio: snapshotRatio.toString(),
        snapshotTimestamp: Number(snapshotTimestamp),
        maxYearlyGrowthPercent: Number(maxYearlyGrowthPercent),
        isCapped,
        blockNumber: block.number,
        timestamp: block.timestamp,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to get oracle data oracle=${oracle.address} blockNumber=${blockNumber} error=${message}`,
      );
      throw error;
    }
  }

  calculateCapoValues(oracleData: OracleData): CapoValues {
    const currentTime = oracleData.timestamp;
    const timeDiff = Math.max(0, currentTime - oracleData.snapshotTimestamp);

    const maxRatio = this.calculateMaxRatio(
      oracleData.snapshotRatio,
      oracleData.maxYearlyGrowthPercent,
      timeDiff,
    );

    const currentGrowthRate = this.calculateGrowthRate(
      oracleData.snapshotRatio,
      oracleData.ratio,
      timeDiff,
    );

    const bps = oracleData.maxYearlyGrowthPercent;
    const maxGrowthFraction = bps / 10_000;
    const maxGrowthPercent = bps / 100;

    const utilization = this.calculateUtilization(
      oracleData.snapshotRatio,
      oracleData.ratio,
      maxRatio.toString(),
    );

    this.logger.log(
      `Oracle ${oracleData.snapshotRatio} - ${oracleData.ratio} | dt=${timeDiff}s | ` +
        `Current growth: ${currentGrowthRate.toFixed(4)}% | ` +
        `Max allowed: ${maxGrowthFraction} (fraction) ~= ${maxGrowthPercent}% | ` +
        `Utilization: ${utilization.toFixed(2)}% | ` +
        `Capped: ${oracleData.isCapped}`,
    );

    return {
      currentRatio: oracleData.ratio,
      maxRatio: maxRatio.toString(),
      currentGrowthRate,
      maxGrowthRate: maxGrowthPercent,
      isCapped: oracleData.isCapped,
      utilizationPercent: utilization,
    };
  }

  public calculateMaxRatio(
    snapshotRatio: string,
    maxYearlyGrowthPercentBps: number,
    timeDiff: number,
  ): bigint {
    const BASIS_POINTS = 10_000n;
    const SECONDS_PER_YEAR = 365n * 24n * 60n * 60n;
    const GROWTH_RATIO_SCALE = 10_000_000_000n;

    const ratio = BigInt(snapshotRatio);
    const growthBps = BigInt(maxYearlyGrowthPercentBps);
    const dt = BigInt(Math.max(0, timeDiff));

    const maxPerSec = (ratio * growthBps * GROWTH_RATIO_SCALE) / BASIS_POINTS / SECONDS_PER_YEAR;

    return ratio + (maxPerSec * dt) / GROWTH_RATIO_SCALE;
  }

  private calculateGrowthRate(
    snapshotRatio: string,
    currentRatio: string,
    timeDiff: number,
  ): number {
    if (timeDiff <= 0) return 0;

    const snapshot = BigInt(snapshotRatio);
    const current = BigInt(currentRatio);
    if (snapshot === 0n || current <= snapshot) return 0;

    const diff = current - snapshot;
    const SECONDS_PER_YEAR = 365n * 24n * 60n * 60n;
    const dt = BigInt(timeDiff);

    const annualBps = (diff * SECONDS_PER_YEAR * 10_000n) / (snapshot * dt);
    return Number(annualBps) / 100;
  }

  private calculateUtilization(
    snapshotRatio: string,
    currentRatio: string,
    maxRatio: string,
  ): number {
    const snapshot = BigInt(snapshotRatio);
    const current = BigInt(currentRatio);
    const max = BigInt(maxRatio);

    if (max <= snapshot) return 0;

    const used = current > snapshot ? current - snapshot : 0n;
    const cap = max - snapshot;

    const utilBps = (used * 10_000n) / cap;
    return Number(utilBps) / 100;
  }
}
