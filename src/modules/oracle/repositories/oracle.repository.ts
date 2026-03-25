import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Oracle } from 'modules/oracle/oracle.entity';

@Injectable()
export class OracleRepository {
  constructor(
    @InjectRepository(Oracle)
    private readonly repository: Repository<Oracle>,
  ) {}

  async listActive(): Promise<Oracle[]> {
    return this.repository.find({
      where: { isActive: true },
      order: { id: 'ASC' },
    });
  }

  async findByAddress(address: string): Promise<Oracle | null> {
    return this.repository.findOne({
      where: { address },
    });
  }

  async findByAddressWithAsset(address: string): Promise<Oracle | null> {
    return this.repository.findOne({
      where: { address },
      relations: ['asset'],
    });
  }

  async upsertByAddress(oracle: Partial<Oracle> | Array<Partial<Oracle>>): Promise<void> {
    await this.repository.upsert(oracle, ['address']);
  }

  async save(oracle: Oracle): Promise<Oracle> {
    return this.repository.save(oracle);
  }
}
