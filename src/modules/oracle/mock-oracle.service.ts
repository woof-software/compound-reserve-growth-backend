import { Injectable, Logger } from '@nestjs/common';

import { Oracle } from './oracle.entity';

export interface MockOracleData {
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
export class MockOracleService {
  private readonly logger = new Logger(MockOracleService.name);

  private state = new Map<
    string,
    { ratio: bigint; price: bigint; snapshotRatio: bigint; snapshotTimestamp: number }
  >();

  async getOracleData(oracle: Oracle): Promise<MockOracleData> {
    const now = Math.floor(Date.now() / 1_000);

    const GROWTH_BPS_PER_MIN = 1n;
    const SNAPSHOT_INTERVAL_SEC = 3600;

    let s = this.state.get(oracle.address);
    if (!s) {
      const initialRatio = 1n * 10n ** 18n;
      const initialPrice = 2_000n * 10n ** 8n;
      s = {
        ratio: initialRatio,
        price: initialPrice,
        snapshotRatio: initialRatio,
        snapshotTimestamp: now,
      };
    }

    s.ratio += (s.ratio * GROWTH_BPS_PER_MIN) / 10_000n;

    if (now - s.snapshotTimestamp >= SNAPSHOT_INTERVAL_SEC) {
      s.snapshotRatio = s.ratio;
      s.snapshotTimestamp = now;
    }

    const deltaPct = (Math.random() - 0.5) / 100;
    const priceNumber = Number(s.price) / 1e8;
    const newPriceNumber = priceNumber * (1 + deltaPct);
    s.price = BigInt(Math.round(newPriceNumber * 1e8));

    const timeDiff = now - s.snapshotTimestamp;
    const maxRatioBig = this.calculateMaxRatio(s.snapshotRatio.toString(), 500, timeDiff);
    const isCapped = s.ratio >= maxRatioBig;

    this.state.set(oracle.address, s);

    return {
      ratio: s.ratio.toString(),
      price: s.price.toString(),
      snapshotRatio: s.snapshotRatio.toString(),
      snapshotTimestamp: s.snapshotTimestamp,
      maxYearlyGrowthPercent: 500,
      isCapped,
      blockNumber: 0,
      timestamp: now,
    };
  }

  calculateCapoValues(oracleData: MockOracleData) {
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
