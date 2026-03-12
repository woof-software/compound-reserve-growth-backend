import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Snapshot } from 'modules/capo/entities/snapshot.entity';

@Injectable()
export class SnapshotRepository {
  constructor(
    @InjectRepository(Snapshot)
    private readonly repository: Repository<Snapshot>,
  ) {}

  create(data: Partial<Snapshot>): Snapshot {
    return this.repository.create(data);
  }

  async save(snapshot: Snapshot): Promise<Snapshot> {
    return this.repository.save(snapshot);
  }

  async findLatest(): Promise<Snapshot | null> {
    return this.repository
      .createQueryBuilder('snapshot')
      .orderBy('snapshot.timestamp', 'DESC')
      .limit(1)
      .getOne();
  }

  async findLatestForOracleInRange(
    oracleAddress: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Snapshot | null> {
    return this.repository
      .createQueryBuilder('snapshot')
      .where('snapshot.oracleAddress = :address', { address: oracleAddress })
      .andWhere('snapshot.timestamp >= :startDate', { startDate })
      .andWhere('snapshot.timestamp < :endDate', { endDate })
      .orderBy('snapshot.timestamp', 'DESC')
      .limit(1)
      .getOne();
  }

  async findLatestBefore(oracleAddress: string, time: Date): Promise<Snapshot | null> {
    return this.repository
      .createQueryBuilder('snapshot')
      .where('snapshot.oracleAddress = :address', { address: oracleAddress })
      .andWhere('snapshot.timestamp <= :time', { time })
      .orderBy('snapshot.timestamp', 'DESC')
      .getOne();
  }
}
