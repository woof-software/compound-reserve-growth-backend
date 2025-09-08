import { ApiProperty } from '@nestjs/swagger';

import { StatsHistory } from 'modules/history/entities';

export class StatsHistoryResponse {
  @ApiProperty({
    example: {
      id: 1,
      vs: 100.5,
      vb: 20.25,
      d: 1750809600,
    },
    description: 'Incomes stats for the period',
  })
  public incomes: {
    id: number;
    vs: number;
    vb: number;
    d: number; // epoch seconds
  };

  @ApiProperty({
    example: {
      id: 2,
      vs: 50.0,
      vb: 10.0,
      d: 1750809600,
    },
    description: 'Spends stats for the period',
  })
  public spends: {
    id: number;
    vs: number;
    vb: number;
    d: number; // epoch seconds
  };

  @ApiProperty({
    example: 12,
    description: 'ID of the source that generated these stats',
  })
  public sourceId: number;

  constructor(statsHistory: StatsHistory) {
    this.incomes = {
      id: statsHistory.incomes.id,
      vs: statsHistory.incomes.valueSupply,
      vb: statsHistory.incomes.valueBorrow,
      d: new Date(statsHistory.incomes.date).getTime() / 1000,
    };
    this.spends = {
      id: statsHistory.spends.id,
      vs: statsHistory.spends.valueSupply,
      vb: statsHistory.spends.valueBorrow,
      d: new Date(statsHistory.spends.date).getTime() / 1000,
    };
    this.sourceId = statsHistory.sourceId;
  }
}
