import { Injectable, Logger } from '@nestjs/common';
import { ethers } from 'ethers';

import { ProviderFactory } from 'modules/network/provider.factory';
import CapoABI from 'modules/capo/abi/ERC4626CorrelatedAssetsPriceOracle.json';

import { Oracle } from './oracle.entity';

interface OracleData {
  ratio: string;
  price: string;
  snapshotRatio: string;
  snapshotTimestamp: number;
  maxYearlyGrowthPercent: number;
  isCapped: boolean;
  blockNumber: number;
  timestamp: number;
}

@Injectable()
export class OracleService {
  private readonly logger = new Logger(OracleService.name);

  constructor(private readonly providerFactory: ProviderFactory) {}

  async getOracleData(oracle: Oracle): Promise<OracleData> {
    try {
      const provider = this.providerFactory.get(oracle.network);
      const oracleContract = new ethers.Contract(oracle.address, CapoABI, provider);

      const currentBlock = await provider.getBlock('latest');

      const latestRoundData = await oracleContract.latestRoundData();
      const ratio = await oracleContract.getRatio();
      const isCapped = await oracleContract.isCapped();
      const decimals = await oracleContract.decimals();
      const snapshotRatio = await oracleContract.snapshotRatio();
      const snapshotTimestamp = await oracleContract.snapshotTimestamp();
      const maxYearlyGrowthPercent = await oracleContract.maxYearlyRatioGrowthPercent();

      const price = latestRoundData.answer;
      return {
        ratio: ratio.toString(),
        price: ethers.formatUnits(price, decimals),
        snapshotRatio: snapshotRatio.toString(),
        snapshotTimestamp: Number(snapshotTimestamp),
        maxYearlyGrowthPercent: Number(maxYearlyGrowthPercent),
        isCapped,
        blockNumber: currentBlock.number,
        timestamp: currentBlock.timestamp,
      };
    } catch (error) {
      this.logger.error(`Failed to get oracle data for ${oracle.address}:`, error);
      throw error;
    }
  }

  calculateCapoValues(oracleData: OracleData) {
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
        `Max allowed: ${maxGrowthFraction} (fraction) ≈ ${maxGrowthPercent}% | ` +
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
