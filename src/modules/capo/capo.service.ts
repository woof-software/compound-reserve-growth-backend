import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';

import { Snapshot } from './entities/snapshot.entity';
import { DailyAggregation } from './entities/daily.entity';
import { Oracle } from './entities/oracle.entity';
import { OracleService } from './oracle.service';
import { DiscoveryService } from './discovery.service';
import { AlertService } from './alert.service';

@Injectable()
export class CapoService implements OnModuleInit {
  private readonly logger = new Logger(CapoService.name);

  constructor(
    @InjectRepository(Snapshot)
    private snapshotRepository: Repository<Snapshot>,
    @InjectRepository(DailyAggregation)
    private aggregationRepository: Repository<DailyAggregation>,
    @InjectRepository(Oracle)
    private oracleRepository: Repository<Oracle>,
    private oracleService: OracleService,
    private discoveryService: DiscoveryService,
    private alertService: AlertService,
  ) {}

  async onModuleInit() {
    this.logger.log('CapoService initialized');
    await this.discoveryService.syncFromSources();
    await this.collectOracleData();
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async collectOracleData() {
    this.logger.log('Starting oracle data collection...');

    const oracles = await this.oracleRepository.find({ where: { isActive: true } });
    this.logger.log(`Found ${oracles.length} active oracles to monitor`);

    for (const oracle of oracles) {
      try {
        const data = await this.oracleService.getOracleData(oracle);

        const capoValues = this.oracleService.calculateCapoValues(data);

        this.logger.log(`Oracle ${oracle.description}: 
          Current growth rate: ${capoValues.currentGrowthRate.toFixed(2)}%, 
          Max allowed: ${capoValues.maxGrowthRate.toFixed(2)}%, 
          Utilization: ${capoValues.utilizationPercent.toFixed(2)}%, 
          Capped: ${capoValues.isCapped}`);

        const snapshot = this.snapshotRepository.create({
          oracleAddress: oracle.address,
          oracleName: oracle.description,
          chainId: oracle.chainId,
          ratio: data.ratio,
          price: data.price,
          snapshotRatio: data.snapshotRatio,
          snapshotTimestamp: data.snapshotTimestamp,
          maxYearlyGrowthPercent: data.maxYearlyGrowthPercent,
          isCapped: data.isCapped,
          currentGrowthRate: capoValues.currentGrowthRate.toString(),
          blockNumber: data.blockNumber,
          metadata: {
            maxRatio: capoValues.maxRatio,
            utilizationPercent: capoValues.utilizationPercent,
            timestamp: data.timestamp,
          },
        });

        await this.snapshotRepository.save(snapshot);

        await this.checkAlerts(oracle, data, capoValues);

        await this.check24hPriceGrowth(oracle, data);
      } catch (error) {
        this.logger.error(`Failed to collect data for ${oracle.description}:`, error);
        await this.alertService.createAlert(
          oracle.address,
          oracle.chainId,
          'ERROR',
          'critical',
          `Failed to collect oracle data: ${error.message}`,
          { error: error.toString() },
        );
      }
    }
  }

  private async checkAlerts(oracle: Oracle, data: any, capoValues: any) {
    if (data.isCapped) {
      await this.alertService.createAlert(
        oracle.address,
        oracle.chainId,
        'CAPPED',
        'warning',
        `Oracle ${oracle.description} is currently capped at max allowed ratio`,
        {
          currentRatio: data.ratio,
          maxRatio: capoValues.maxRatio,
          utilizationPercent: capoValues.utilizationPercent,
        },
      );
    }

    if (capoValues.utilizationPercent > 90) {
      await this.alertService.createAlert(
        oracle.address,
        oracle.chainId,
        'RAPID_GROWTH',
        'warning',
        `Oracle ${oracle.description} growth approaching cap (${capoValues.utilizationPercent.toFixed(1)}% utilized)`,
        {
          currentGrowthRate: capoValues.currentGrowthRate,
          maxGrowthRate: capoValues.maxGrowthRate,
          utilizationPercent: capoValues.utilizationPercent,
        },
      );
    }

    if (capoValues.currentGrowthRate > 0 && capoValues.utilizationPercent < 10) {
      await this.alertService.createAlert(
        oracle.address,
        oracle.chainId,
        'SLOW_GROWTH',
        'info',
        `Oracle ${oracle.description} growth unusually slow (${capoValues.utilizationPercent.toFixed(1)}% utilized)`,
        {
          currentGrowthRate: capoValues.currentGrowthRate,
          maxGrowthRate: capoValues.maxGrowthRate,
        },
      );
    }
  }

  private async check24hPriceGrowth(oracle: Oracle, currentData: any) {
    try {
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

      const oldSnapshot = await this.snapshotRepository
        .createQueryBuilder('snapshot')
        .where('snapshot.oracleAddress = :address', { address: oracle.address })
        .andWhere('snapshot.timestamp <= :time', { time: twentyFourHoursAgo })
        .orderBy('snapshot.timestamp', 'DESC')
        .getOne();

      if (!oldSnapshot) {
        this.logger.log(`No 24h data available for ${oracle.description}`);
        return;
      }

      const currentPrice = BigInt(currentData.price);
      const oldPrice = BigInt(oldSnapshot.price);

      if (oldPrice === 0n) return;

      const priceChange = ((currentPrice - oldPrice) * 10000n) / oldPrice;
      const priceChangePercent = Number(priceChange) / 100;

      this.logger.log(`${oracle.description} 24h price change: ${priceChangePercent.toFixed(2)}%`);

      const PRICE_ALERT_THRESHOLD = 10; // percent

      if (priceChangePercent > PRICE_ALERT_THRESHOLD) {
        await this.alertService.createAlert(
          oracle.address,
          oracle.chainId,
          'PRICE_SPIKE',
          'critical',
          `Price increased by ${priceChangePercent.toFixed(2)}% in 24 hours for ${oracle.description}`,
          {
            currentPrice: currentData.price,
            oldPrice: oldSnapshot.price,
            priceChangePercent,
            threshold: PRICE_ALERT_THRESHOLD,
          },
        );
      }
    } catch (error) {
      this.logger.error(`Failed to check 24h price growth for ${oracle.description}:`, error);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async aggregateDailyData() {
    this.logger.log('Starting daily aggregation...');

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const oracles = await this.oracleRepository.find();

    for (const oracle of oracles) {
      try {
        const snapshots = await this.snapshotRepository.find({
          where: {
            oracleAddress: oracle.address,
            timestamp: Between(yesterday, today),
          },
        });

        if (snapshots.length === 0) {
          this.logger.log(
            `No snapshots found for ${oracle.description} on ${yesterday.toISOString().split('T')[0]}`,
          );
          continue;
        }

        const aggregation = this.calculateAggregation(oracle, snapshots, yesterday);
        await this.aggregationRepository.save(aggregation);

        this.logger.log(`Aggregated ${snapshots.length} snapshots for ${oracle.description}`);
      } catch (error) {
        this.logger.error(`Failed to aggregate data for ${oracle.description}:`, error);
      }
    }
  }

  private calculateAggregation(
    oracle: Oracle,
    snapshots: Snapshot[],
    date: Date,
  ): DailyAggregation {
    const ratios = snapshots.map((s) => BigInt(s.ratio));
    const prices = snapshots.map((s) => BigInt(s.price));

    const avgRatio = ratios.reduce((a, b) => a + b, 0n) / BigInt(ratios.length);
    const avgPrice = prices.reduce((a, b) => a + b, 0n) / BigInt(prices.length);

    const minRatio = ratios.reduce((a, b) => (a < b ? a : b));
    const maxRatio = ratios.reduce((a, b) => (a > b ? a : b));

    const minPrice = prices.reduce((a, b) => (a < b ? a : b));
    const maxPrice = prices.reduce((a, b) => (a > b ? a : b));

    const cappedCount = snapshots.filter((s) => s.isCapped).length;

    return this.aggregationRepository.create({
      oracleAddress: oracle.address,
      oracleName: oracle.description,
      chainId: oracle.chainId,
      date,
      avgRatio: avgRatio.toString(),
      minRatio: minRatio.toString(),
      maxRatio: maxRatio.toString(),
      avgPrice: avgPrice.toString(),
      minPrice: minPrice.toString(),
      maxPrice: maxPrice.toString(),
      cappedCount,
      totalCount: snapshots.length,
    });
  }

  async listDailyAggregations(oracleAddress?: string): Promise<DailyAggregation[]> {
    const where = oracleAddress ? { oracleAddress } : {};
    return this.aggregationRepository.find({ where, order: { date: 'DESC' } });
  }
}
