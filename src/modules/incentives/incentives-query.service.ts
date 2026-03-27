import { Injectable } from '@nestjs/common';

import { OffsetDto } from 'modules/history/dto/offset.dto';

import { IncentivesRepository } from './incentives.repository';
import { IncentiveEntity } from './incentive.entity';

import { OffsetDataDto } from '@/common/dto/offset-data.dto';

@Injectable()
export class IncentivesQueryService {
  constructor(private readonly incentivesRepository: IncentivesRepository) {}

  public async getOffsetHistory(dto: OffsetDto): Promise<OffsetDataDto<IncentiveEntity>> {
    return this.incentivesRepository.getOffsetHistory(dto);
  }
}
