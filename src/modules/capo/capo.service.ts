import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';

import { Oracle } from 'modules/oracle/oracle.entity';
import { OracleService } from 'modules/oracle/oracle.service';
import { DiscoveryService } from 'modules/oracle/discovery.service';
import { AlertService } from 'modules/alert/alert.service';

import { Snapshot } from './snapshot.entity';
import { DailyAggregation } from './daily.entity';
import { Source } from 'modules/source/source.entity';
import { DailyAggregationResponse } from './response/daily.response';
import { OffsetDataDto } from '@app/common/dto/offset-data.dto';
import { OffsetRequest } from 'modules/history/request/offset.request';
import { Order } from '@app/common/enum/order.enum';
import { PaginatedDataDto } from '@app/common/dto/paginated-data.dto';
import { PaginationRequest } from 'modules/history/request/pagination.request';

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
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async collectOracleData() {
    if(this.isCollecting) {
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
          
          this.logger.log(`Oracle ${oracle.description}: Current growth rate: ${capoValues.currentGrowthRate.toFixed(2)}%, Max allowed: ${capoValues.maxGrowthRate.toFixed(2)}%, Utilization: ${capoValues.utilizationPercent.toFixed(2)}%, Capped: ${capoValues.isCapped}`);

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
            { error: error.toString() }
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
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async aggregateDailyData() {
    this.logger.log('Starting daily aggregation...');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 1);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 1);

    const results = await this.snapshotRepository
      .createQueryBuilder('snapshot')
      .select([
        'snapshot.oracleAddress as "oracleAddress"',
        'snapshot.oracleName as "oracleName"',
        'snapshot.chainId as "chainId"',
        'AVG(CAST(snapshot.ratio AS DECIMAL(78,0))) as "avgRatio"',
        'MIN(CAST(snapshot.ratio AS DECIMAL(78,0))) as "minRatio"',
        'MAX(CAST(snapshot.ratio AS DECIMAL(78,0))) as "maxRatio"',
        'AVG(CAST(snapshot.price AS DECIMAL(78,0))) as "avgPrice"',
        'MIN(CAST(snapshot.price AS DECIMAL(78,0))) as "minPrice"',
        'MAX(CAST(snapshot.price AS DECIMAL(78,0))) as "maxPrice"',
        'COUNT(CASE WHEN snapshot.isCapped = true THEN 1 END) as "cappedCount"',
        'COUNT(*) as "totalCount"',
      ])
      .where('snapshot.timestamp >= :startDate', { startDate })
      .andWhere('snapshot.timestamp < :endDate', { endDate })
      .andWhere('snapshot.ratio IS NOT NULL')
      .andWhere('snapshot.price IS NOT NULL')
      .andWhere("snapshot.ratio != ''")
      .andWhere("snapshot.price != ''")
      .groupBy('snapshot.oracleAddress')
      .addGroupBy('snapshot.oracleName')
      .addGroupBy('snapshot.chainId')
      .having('COUNT(*) > 0')
      .orderBy('snapshot.oracleAddress', 'ASC')
      .getRawMany();

    for (const row of results) {
      try {
        const oracle = await this.oracleRepository.findOne({
          where: { address: row.oracleAddress }
        });

        let source;
        let sourceId;
        let assetId
        if (oracle) {
          source = await this.sourceRepository.findOne({
            where: { network: oracle.network }
          });
          sourceId = source?.id || null;
          assetId = source?.assetId || null; 
        }

        const aggregation = this.aggregationRepository.create({
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
          cappedCount: Number(row.cappedCount ?? 0),
          totalCount: Number(row.totalCount ?? 0),
          sourceId: sourceId,
          assetId: assetId
        });

        await this.aggregationRepository.save(aggregation);
        this.logger.log(`Saved aggregation for oracle ${row.oracleAddress}`);
      } catch (error) {
        this.logger.error(`Failed to save aggregation for oracle ${row.oracleAddress}:`, error);
      }
    }

    this.logger.log(`Daily aggregation complete. Processed ${results.length} oracles.`);
  }

  async listDailyAggregations(params?: {
    sourceId?: number;
    assetId?: number;
  }): Promise<DailyAggregationResponse[]> {
    const qb = this.aggregationRepository.createQueryBuilder('agg');

    if (params?.sourceId !== undefined) {
      qb.andWhere('agg.sourceId = :sourceId', { sourceId: params.sourceId });
    }
    if (params?.assetId !== undefined) {
      qb.andWhere('agg.assetId = :assetId', { assetId: params.assetId });
    }

    qb.orderBy('agg.date', 'DESC');

    const rows = await qb.getMany();

    return rows.map((r) => this.toResponse(r));
  }

  async getPaginatedDailyAggregations(
    dto: PaginationRequest & { sourceId?: number; assetId?: number },
  ): Promise<PaginatedDataDto<DailyAggregationResponse>> {
    const { page = 1, perPage, order = Order.DESC, sourceId, assetId } = dto;

    const qb = this.aggregationRepository.createQueryBuilder('agg');

    if (sourceId !== undefined) qb.andWhere('agg.sourceId = :sourceId', { sourceId });
    if (assetId !== undefined) qb.andWhere('agg.assetId = :assetId', { assetId });

    const total = await qb.getCount();

    qb.orderBy('agg.date', order).skip((page - 1) * (perPage ?? total));
    if (perPage) qb.take(perPage);

    const rows = await qb.getMany();

    return new PaginatedDataDto<DailyAggregationResponse>(
      rows.map((r) => this.toResponse(r)),
      page,
      perPage ?? total,
      total,
    );
  }

  async getOffsetDailyAggregations(
    dto: OffsetRequest& { sourceId?: number; assetId?: number },
  ): Promise<OffsetDataDto<DailyAggregationResponse>> {
    const { offset = 0, limit = null, order = Order.DESC, sourceId, assetId } = dto;

    const qb = this.aggregationRepository.createQueryBuilder('agg');

    if (sourceId !== undefined) qb.andWhere('agg.sourceId = :sourceId', { sourceId });
    if (assetId !== undefined) qb.andWhere('agg.assetId = :assetId', { assetId });

    const total = await qb.getCount();

    qb.orderBy('agg.date', order).offset(offset);
    if (limit !== null) qb.limit(limit);

    const rows = await qb.getMany();

    return new OffsetDataDto<DailyAggregationResponse>(
      rows.map((r) => this.toResponse(r)),
      limit,
      offset,
      total,
    );
  }

  private toResponse(entity: DailyAggregation): DailyAggregationResponse {
    return {
      oracleAddress: entity.oracleAddress,
      oracleName: entity.oracleName,
      chainId: entity.chainId,
      date: entity.date.toISOString().split('T')[0],
      avgRatio: entity.avgRatio,
      minRatio: entity.minRatio,
      maxRatio: entity.maxRatio,
      avgPrice: entity.avgPrice,
      minPrice: entity.minPrice,
      maxPrice: entity.maxPrice,
      cappedCount: entity.cappedCount,
      totalCount: entity.totalCount,
      sourceId: entity.sourceId,
      assetId: entity.assetId,
    };
  }
}