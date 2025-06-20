import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsNumber } from 'class-validator';

export class UpdateSourceRequest {
  @ApiProperty({ example: 1, description: 'Source ID' })
  @IsInt()
  public id: number;

  @ApiPropertyOptional({ example: 20000000, description: 'Last synced block' })
  @IsOptional()
  @IsNumber()
  public blockNumber?: number;
}
