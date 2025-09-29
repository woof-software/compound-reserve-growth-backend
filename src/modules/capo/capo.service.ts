import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';

import { Oracle } from 'modules/oracle/oracle.entity';
import { OracleService } from 'modules/oracle/oracle.service';
import { AlertService } from 'modules/alert/alert.service';
import { Source } from 'modules/source/source.entity';
import { OffsetRequest } from 'modules/history/request/offset.request';
import { ProviderFactory } from 'modules/network/provider.factory';

import { Snapshot } from './snapshot.entity';
import { DailyAggregation } from './daily.entity';
import { CapoResponse } from './response/capo.response';

import { OffsetDataDto } from '@app/common/dto/offset-data.dto';
import { Order } from '@app/common/enum/order.enum';

@Injectable()
export class CapoService {
  private readonly logger = new Logger(CapoService.name);

  private isCollecting = false;

  constructor(
    @InjectRepository(Snapshot)
    private snapshotRepository: Repository<Snapshot>,
    @InjectRepository(DailyAggregation)
    private aggregationRepository: Repository<DailyAggregation>,
    @InjectRepository(Oracle)
    private oracleRepository: Repository<Oracle>,
    @InjectRepository(Source)
    private sourceRepository: Repository<Source>,
    private oracleService: OracleService,
    private alertService: AlertService,
    private providerFactory: ProviderFactory,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async collectOracleData() {
    if (this.isCollecting) {
      this.logger.warn('Data collection already in progress, skipping this run');
      return;
    }

    this.isCollecting = true;

    try {
      this.logger.log('Starting oracle data collection...');
      const oracles = await this.oracleRepository.find({ where: { isActive: true } });
      this.logger.log(`Found ${oracles.length} active oracles to monitor`);

      for (const oracle of oracles) {
        try {
          const data = await this.oracleService.getOracleData(oracle);
          const capoValues = this.oracleService.calculateCapoValues(data);

          this.logger.log(
            `Oracle ${oracle.description}: Current growth rate: ${capoValues.currentGrowthRate.toFixed(2)}%, Max allowed: ${capoValues.maxGrowthRate.toFixed(2)}%, Utilization: ${capoValues.utilizationPercent.toFixed(2)}%, Capped: ${capoValues.isCapped}`,
          );

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

      this.logger.log('Oracle data collection completed successfully');
    } catch (error) {
      this.logger.error('Error during oracle data collection:', error);
    } finally {
      this.isCollecting = false;
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

      const currentPrice = Number(currentData.price);
      const oldPrice = Number(oldSnapshot.price);

      if (oldPrice === 0) return;

      const priceChangePercent = ((currentPrice - oldPrice) / oldPrice) * 100;

      this.logger.log(`${oracle.description} 24h price change: ${priceChangePercent.toFixed(2)}%`);

      const PRICE_ALERT_THRESHOLD = 10;

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

  @Cron('0 */3 * * * *')
  async aggregateDailyData() {
    this.logger.log('Starting daily aggregation...');

    const provider = this.providerFactory.get('mainnet');
    const latestBlock = await provider.getBlock('latest');
    const chainNow = new Date(latestBlock.timestamp * 1000);
    const systemNow = new Date();

    this.logger.log(
      `System time: ${systemNow.toISOString()}, Chain time: ${chainNow.toISOString()}`,
    );

    const latestSnapshot = await this.snapshotRepository
      .createQueryBuilder('snapshot')
      .orderBy('snapshot.timestamp', 'DESC')
      .limit(1)
      .getOne();

    if (!latestSnapshot) {
      this.logger.log('No snapshots found to aggregate');
      return;
    }

    const latestSnapshotDate = new Date(latestSnapshot.timestamp);
    this.logger.log(`Latest snapshot date: ${latestSnapshotDate.toISOString()}`);

    const startDate = new Date(
      Date.UTC(
        latestSnapshotDate.getUTCFullYear(),
        latestSnapshotDate.getUTCMonth(),
        latestSnapshotDate.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    );

    const endDate = new Date(
      Date.UTC(
        latestSnapshotDate.getUTCFullYear(),
        latestSnapshotDate.getUTCMonth(),
        latestSnapshotDate.getUTCDate() + 1,
        0,
        0,
        0,
        0,
      ),
    );

    this.logger.log(
      `Aggregating data for date range: ${startDate.toISOString()} to ${endDate.toISOString()}`,
    );

    const results = await this.snapshotRepository
      .createQueryBuilder('snapshot')
      .select([
        'snapshot.oracleAddress as "oracleAddress"',
        'snapshot.oracleName as "oracleName"',
        'snapshot.chainId as "chainId"',
        'AVG(snapshot.ratio) as "avgRatio"',
        'MIN(snapshot.ratio) as "minRatio"',
        'MAX(snapshot.ratio) as "maxRatio"',
        'AVG(snapshot.price) as "avgPrice"',
        'MIN(snapshot.price) as "minPrice"',
        'MAX(snapshot.price) as "maxPrice"',
        'COUNT(CASE WHEN snapshot.isCapped = true THEN 1 END) as "cappedCount"',
        'COUNT(*) as "totalCount"',
      ])
      .where('snapshot.timestamp >= :startDate', { startDate })
      .andWhere('snapshot.timestamp < :endDate', { endDate })
      .andWhere('snapshot.ratio IS NOT NULL')
      .andWhere('snapshot.price IS NOT NULL')
      .groupBy('snapshot.oracleAddress')
      .addGroupBy('snapshot.oracleName')
      .addGroupBy('snapshot.chainId')
      .having('COUNT(*) > 0')
      .orderBy('snapshot.oracleAddress', 'ASC')
      .getRawMany();

    this.logger.log(`Found ${results.length} oracles with data for aggregation`);

    for (const row of results) {
      try {
        const oracle = await this.oracleRepository.findOne({
          where: { address: row.oracleAddress },
          relations: ['asset'],
        });

        const latestOracleSnapshot = await this.snapshotRepository
          .createQueryBuilder('snapshot')
          .where('snapshot.oracleAddress = :address', { address: row.oracleAddress })
          .andWhere('snapshot.timestamp >= :startDate', { startDate })
          .andWhere('snapshot.timestamp < :endDate', { endDate })
          .orderBy('snapshot.timestamp', 'DESC')
          .limit(1)
          .getOne();

        let maxCapPrice = null;
        if (latestOracleSnapshot) {
          try {
            const currentTimestamp = Math.floor(chainNow.getTime() / 1000);
            const timeDiff = Math.max(
              0,
              currentTimestamp - Number(latestOracleSnapshot.snapshotTimestamp),
            );

            const maxRatio = this.oracleService.calculateMaxRatio(
              latestOracleSnapshot.snapshotRatio,
              Number(latestOracleSnapshot.maxYearlyGrowthPercent),
              timeDiff,
            );

            const currentRatio = BigInt(latestOracleSnapshot.ratio);
            const currentPriceNum = parseFloat(latestOracleSnapshot.price);

            if (currentRatio > 0n && currentPriceNum > 0) {
              const maxCapPriceCalculated =
                (Number(maxRatio) / Number(currentRatio)) * currentPriceNum;
              maxCapPrice = maxCapPriceCalculated.toString();

              this.logger.log(
                `Oracle ${row.oracleAddress}: Max cap price calculated as ${maxCapPriceCalculated.toFixed(6)}`,
              );
            }
          } catch (error) {
            this.logger.error(
              `Failed to calculate max cap price for oracle ${row.oracleAddress}:`,
              error,
            );
          }
        }

        const existingAggregation = await this.aggregationRepository.findOne({
          where: {
            oracleAddress: row.oracleAddress,
            date: startDate,
          },
        });

        let aggregation;
        if (existingAggregation) {
          Object.assign(existingAggregation, {
            avgRatio: row.avgRatio,
            minRatio: row.minRatio,
            maxRatio: row.maxRatio,
            avgPrice: row.avgPrice,
            minPrice: row.minPrice,
            maxPrice: row.maxPrice,
            cap: maxCapPrice,
            cappedCount: Number(row.cappedCount ?? 0),
            totalCount: Number(row.totalCount ?? 0),
            assetId: oracle.asset.id,
          });
          aggregation = existingAggregation;
          this.logger.log(`Updating existing aggregation for oracle ${row.oracleAddress}`);
        } else {
          aggregation = this.aggregationRepository.create({
            oracleAddress: row.oracleAddress,
            oracleName: row.oracleName,
            chainId: row.chainId,
            date: startDate,
            avgRatio: row.avgRatio,
            minRatio: row.minRatio,
            maxRatio: row.maxRatio,
            avgPrice: row.avgPrice,
            minPrice: row.minPrice,
            maxPrice: row.maxPrice,
            cap: maxCapPrice,
            cappedCount: Number(row.cappedCount ?? 0),
            totalCount: Number(row.totalCount ?? 0),
            assetId: oracle.asset.id,
          });
          this.logger.log(`Creating new aggregation for oracle ${row.oracleAddress}`);
        }

        await this.aggregationRepository.save(aggregation);
        this.logger.log(
          `Saved aggregation for oracle ${row.oracleAddress} for date ${startDate.toISOString().split('T')[0]}`,
        );
      } catch (error) {
        this.logger.error(`Failed to save aggregation for oracle ${row.oracleAddress}:`, error);
      }
    }

    this.logger.log(`Daily aggregation complete. Processed ${results.length} oracles.`);
  }

  async getAggregations(
    dto: OffsetRequest & { assetId?: number },
  ): Promise<OffsetDataDto<CapoResponse>> {
    const { offset = 0, limit = null, order = Order.DESC, assetId } = dto;

    const qb = this.aggregationRepository.createQueryBuilder('agg').addSelect(
      (sub) =>
        sub
          .select('s.price')
          .from(Snapshot, 's')
          .where('s.oracleAddress = agg.oracleAddress')
          .andWhere('s.chainId = agg.chainId')
          // Last snapshot for the day
          .andWhere(`s."timestamp" >= (agg.date::timestamp)`)
          .andWhere(`s."timestamp" <  (agg.date::timestamp + interval '1 day')`)
          .orderBy('s."timestamp"', 'DESC')
          .limit(1),
      'lastPrice',
    );

    if (assetId !== undefined) qb.andWhere('agg.assetId = :assetId', { assetId });

    const total = await qb.getCount();

    qb.orderBy('agg.date', order).offset(offset);
    if (limit !== null) qb.limit(limit);

    const { entities, raw } = await qb.getRawAndEntities();

    if (entities.length === 0) {
      this.logger.log('No daily aggregations found for the given parameters');
      return new OffsetDataDto<CapoResponse>([], limit, offset, 0);
    }

    return new OffsetDataDto<CapoResponse>(
      entities.map((e, i) => this.toResponse(e, raw[i]?.lastPrice)),
      limit,
      offset,
      total,
    );
  }

  private toResponse(entity: DailyAggregation, lastPrice?: number | string): CapoResponse {
    /**
     * @param date
     * Accepts:
     *  - Date
     *  - string: anything that can be passed to Date.parse(...)
     * @returns Unix timestamp in seconds
     */
    const normalizeDate = (date: string | Date) => {
      const timestamp = date instanceof Date ? date.getTime() : new Date(date).getTime();
      return Math.floor(timestamp / 1000);
    };

    return {
      oa: entity.oracleAddress,
      on: entity.oracleName,
      d: normalizeDate(entity.date),
      cp: entity.cap,
      lp: String(lastPrice),
      aId: entity.assetId,
    };
  }
}
