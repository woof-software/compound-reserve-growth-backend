import { ApiProperty } from '@nestjs/swagger';

import { StatsHistory } from 'modules/history/entities';

class IncomesStatsResponse {
  @ApiProperty({ example: 1, description: 'id - unique identifier for incomes stats' })
  public id: number;

  @ApiProperty({ example: 100.5, description: 'vs - valueSupply value in USD for supply side' })
  public vs: number;

  @ApiProperty({ example: 20.25, description: 'vb - valueBorrow value in USD for borrow side' })
  public vb: number;

  @ApiProperty({ example: 1750809600, description: 'd - date in seconds since epoch for incomes' })
  public d: number;

  constructor(incomes: any) {
    this.id = incomes.id;
    this.vs = incomes.valueSupply;
    this.vb = incomes.valueBorrow;
    this.d = new Date(incomes.date).getTime() / 1000;
  }
}

class SpendsStatsResponse {
  @ApiProperty({ example: 2, description: 'id - unique identifier for spends stats' })
  public id: number;

  @ApiProperty({ example: 50.0, description: 'vs - valueSupply value in USD for supply side' })
  public vs: number;

  @ApiProperty({ example: 10.0, description: 'vb - valueBorrow value in USD for borrow side' })
  public vb: number;

  @ApiProperty({ example: 1750809600, description: 'd - date in seconds since epoch for spends' })
  public d: number;

  constructor(spends: any) {
    this.id = spends.id;
    this.vs = spends.valueSupply;
    this.vb = spends.valueBorrow;
    this.d = new Date(spends.date).getTime() / 1000;
  }
}

export class StatsHistoryResponse {
  @ApiProperty({
    type: IncomesStatsResponse,
    description: 'Incomes stats for the period',
  })
  public incomes: IncomesStatsResponse;

  @ApiProperty({
    type: SpendsStatsResponse,
    description: 'Spends stats for the period',
    required: false,
  })
  public spends?: SpendsStatsResponse;

  @ApiProperty({
    example: 12,
    description: 'ID of the source that generated these stats',
  })
  public sourceId: number;

  constructor(statsHistory: StatsHistory) {
    this.incomes = new IncomesStatsResponse(statsHistory.incomes);
    this.spends = statsHistory.spends ? new SpendsStatsResponse(statsHistory.spends) : undefined;
    this.sourceId = statsHistory.sourceId;
  }
}
