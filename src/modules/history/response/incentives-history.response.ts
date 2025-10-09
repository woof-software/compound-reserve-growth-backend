import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';
import { IsInt, IsPositive } from 'class-validator';

import { type IncentivesHistory } from 'modules/history/entities';

@Exclude()
export class IncentiveHistoryDto {
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

  constructor(ih: IncentivesHistory) {
    this.i = ih.incomes;
    this.rs = ih.rewardsSupply;
    this.rb = ih.rewardsBorrow;
    this.sid = ih.sourceId;
    this.pc = ih.priceComp;
    this.d = Math.floor(ih.date.getTime() / 1000);
  }
}
