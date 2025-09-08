import { ApiProperty } from '@nestjs/swagger';

import { StatsHistory } from 'modules/history/entities';

export class StatsHistoryResponse {
  @ApiProperty({
    example: {
      id: 1,
      valueSupply: 100.5,
      valueBorrow: 20.25,
      d: 1750809600,
    },
    description: 'Incomes stats for the period',
  })
  public incomes: {
    id: number;
    valueSupply: number;
    valueBorrow: number;
    d: number; // epoch seconds
  };

  @ApiProperty({
    example: {
      id: 2,
      valueSupply: 50.0,
      valueBorrow: 10.0,
      d: 1750809600,
    },
    description: 'Spends stats for the period',
  })
  public spends: {
    id: number;
    valueSupply: number;
    valueBorrow: number;
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
      valueSupply: statsHistory.incomes.valueSupply,
      valueBorrow: statsHistory.incomes.valueBorrow,
      d: new Date(statsHistory.incomes.date).getTime() / 1000,
    };
    this.spends = {
      id: statsHistory.spends.id,
      valueSupply: statsHistory.spends.valueSupply,
      valueBorrow: statsHistory.spends.valueBorrow,
      d: new Date(statsHistory.spends.date).getTime() / 1000,
    };
    this.sourceId = statsHistory.sourceId;
  }
}
