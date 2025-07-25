import { ApiProperty } from '@nestjs/swagger';

export class RunwayResponse {
  @ApiProperty({ description: 'Type of entry', example: 'provider' })
  type: string;

  @ApiProperty({ description: 'Name of the entry', example: 'Name 1' })
  name: string;

  @ApiProperty({ description: 'Icon key', example: 'name_1' })
  iconKey: string;

  @ApiProperty({ description: 'Discipline', example: 'Technical' })
  discipline: string;

  @ApiProperty({ description: 'Token', example: 'COMP' })
  token: string;

  @ApiProperty({ description: 'Amount', example: 10000 })
  amount: number;

  @ApiProperty({ description: 'Value', example: 2000 })
  value: number;

  @ApiProperty({ description: 'Payment type', example: 'Contract' })
  paymentType: string;

  @ApiProperty({ description: 'Start date', example: '2/2/2024' })
  startDate: string;

  @ApiProperty({ description: 'End date', example: '2/2/2025' })
  endDate: string;

  @ApiProperty({ description: 'Proposal link', example: 'https://example.com/proposal/1' })
  proposalLink: string;

  constructor(
    type: string,
    name: string,
    iconKey: string,
    discipline: string,
    token: string,
    amount: number,
    value: number,
    paymentType: string,
    startDate: string,
    endDate: string,
    proposalLink: string,
  ) {
    this.type = type;
    this.name = name;
    this.iconKey = iconKey;
    this.discipline = discipline;
    this.token = token;
    this.amount = amount;
    this.value = value;
    this.paymentType = paymentType;
    this.startDate = startDate;
    this.endDate = endDate;
    this.proposalLink = proposalLink;
  }
}
