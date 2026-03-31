import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';
import { IsInt, IsPositive } from 'class-validator';

import { IncentiveEntity } from '@/modules/incentives/incentive.entity';

@Exclude()
export class IncentiveHistoryResponse {
  @Expose({ name: 'i' })
  @ApiProperty({ example: 140.5, description: 'i - incomes value in USD' })
  i: number;

  @Expose({ name: 'rs' })
  @ApiProperty({ example: 100.5, description: 'rs - rewardsSupply value in USD' })
  rs: number;

  @Expose({ name: 'rb' })
  @ApiProperty({ example: 20.25, description: 'rb - rewardsBorrow value in USD' })
  rb: number;

  @Expose({ name: 'pc' })
  @ApiProperty({ example: 44.6, description: 'pc - priceComp in USD' })
  pc: number;

  @Expose({ name: 'sid' })
  @IsPositive()
  @IsInt()
  @ApiProperty({ example: 1, description: 'sid - sourceId, integer' })
  sid: number;

  @Expose({ name: 'd' })
  @IsPositive()
  @IsInt()
  @ApiProperty({ example: 1750809600, description: 'd - date, timestamp in seconds' })
  d: number;

  constructor(incentive: IncentiveEntity) {
    this.i = incentive.incomes;
    this.rs = incentive.rewardsSupply;
    this.rb = incentive.rewardsBorrow;
    this.sid = incentive.source.id;
    this.pc = incentive.priceComp;
    this.d = Math.floor(incentive.date.getTime() / 1000);
  }
}
