import { Injectable } from '@nestjs/common';

import { IncentivesRepository } from './incentives.repository';
import { IncentiveEntity } from './incentive.entity';

import { OffsetDataDto } from '@/common/dto/offset-data.dto';
import { OffsetDto } from '@/common/dto/offset.dto';

@Injectable()
export class IncentivesQueryService {
  constructor(private readonly incentivesRepository: IncentivesRepository) {}

  public async getOffsetHistory(dto: OffsetDto): Promise<OffsetDataDto<IncentiveEntity>> {
    return this.incentivesRepository.getOffsetHistory(dto);
  }
}
