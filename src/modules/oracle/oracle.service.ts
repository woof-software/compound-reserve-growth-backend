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
        isCapped: isCapped,
        blockNumber: currentBlock.number,
        timestamp: currentBlock.timestamp,
      };
    } catch (error) {
      this.logger.error(`Failed to get oracle data for ${oracle.address}:`, error);
      throw error;
    }
  }

  async getHistoricalOracleData(oracle: Oracle, blockNumber: number): Promise<OracleData> {
    try {
      const provider = this.providerFactory.get(oracle.network);
      const oracleContract = new ethers.Contract(oracle.address, CapoABI, provider);

      const block = await provider.getBlock(blockNumber);
      if (!block) {
        throw new Error(`Block ${blockNumber} not found`);
      }
      const latestRoundData = await oracleContract.latestRoundData({ blockTag: blockNumber });
      const ratio = await oracleContract.getRatio({ blockTag: blockNumber });
      const isCapped = await oracleContract.isCapped({ blockTag: blockNumber });
      const snapshotRatio = await oracleContract.snapshotRatio({ blockTag: blockNumber });
      const snapshotTimestamp = await oracleContract.snapshotTimestamp({ blockTag: blockNumber });
      const maxYearlyGrowthPercent = await oracleContract.maxYearlyRatioGrowthPercent({
        blockTag: blockNumber,
      });

      const price = latestRoundData.answer;

      return {
        ratio: ratio.toString(),
        price: price.toString(),
        snapshotRatio: snapshotRatio.toString(),
        snapshotTimestamp: Number(snapshotTimestamp),
        maxYearlyGrowthPercent: Number(maxYearlyGrowthPercent),
        isCapped: isCapped,
        blockNumber: block.number,
        timestamp: block.timestamp,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get historical oracle data for ${oracle.address} at block ${blockNumber}:`,
        error,
      );
      throw error;
    }
  }

  calculateCapoValues(oracleData: OracleData) {
    const currentTime = Math.floor(Date.now() / 1000);
    const timeDiff = currentTime - oracleData.snapshotTimestamp;

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
    const maxGrowthRate = oracleData.maxYearlyGrowthPercent / 10000;
    return {
      currentRatio: oracleData.ratio,
      maxRatio: maxRatio.toString(),
      currentGrowthRate,
      maxGrowthRate,
      isCapped: oracleData.isCapped,
      utilizationPercent: this.calculateUtilization(
        oracleData.snapshotRatio,
        oracleData.ratio,
        maxRatio.toString(),
      ),
    };
  }

  private calculateMaxRatio(
    snapshotRatio: string,
    maxYearlyGrowthPercent: number,
    timeDiff: number,
  ): bigint {
    const BASIS_POINTS = 10000n;
    const SECONDS_PER_YEAR = 365n * 24n * 60n * 60n;
    const GROWTH_RATIO_SCALE = 10000000000n;

    const ratio = BigInt(snapshotRatio);
    const growthPercent = BigInt(maxYearlyGrowthPercent);
    const timeDiffBigInt = BigInt(timeDiff);

    const maxRatioGrowthPerSecond =
      (ratio * growthPercent * GROWTH_RATIO_SCALE) / BASIS_POINTS / SECONDS_PER_YEAR;

    return ratio + (maxRatioGrowthPerSecond * timeDiffBigInt) / GROWTH_RATIO_SCALE;
  }

  private calculateGrowthRate(
    snapshotRatio: string,
    currentRatio: string,
    timeDiff: number,
  ): number {
    if (timeDiff === 0) return 0;

    const snapshot = BigInt(snapshotRatio);
    const current = BigInt(currentRatio);

    if (snapshot === 0n || current <= snapshot) return 0;

    const diff = Number(current - snapshot);
    const snap = Number(snapshot);

    const growthFraction = diff / snap;

    const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;
    const annualisedFraction = (growthFraction / timeDiff) * SECONDS_PER_YEAR;

    return annualisedFraction * 100;
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

    const utilization = ((current - snapshot) * 10000n) / (max - snapshot);
    return Number(utilization) / 100;
  }
}
