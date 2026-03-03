import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsNumber } from 'class-validator';

export class UpdateSourceRequest {
  @ApiProperty({ example: 1, description: 'Source ID' })
  @IsInt()
  public id: number;

  @ApiPropertyOptional({ example: 20000000, description: 'Start block number (optional)' })
  @IsOptional()
  @IsNumber()
  public startBlock?: number;

  @ApiPropertyOptional({
    example: 21246747,
    description: 'End block (optional)',
  })
  @IsOptional()
  @IsNumber()
  public endBlock?: number;
}
