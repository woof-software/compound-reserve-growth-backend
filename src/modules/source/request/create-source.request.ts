import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsNumber, IsInt, IsEnum } from 'class-validator';

import { SourceType } from 'modules/source/enum/source-type.enum';

import { Algorithm } from '@app/common/enum/algorithm.enum';

export class CreateSourceRequest {
  @ApiProperty({ example: '0xabc123', description: 'Source address' })
  @IsNotEmpty()
  @IsString()
  public address: string;

  @ApiProperty({ example: 123, description: 'Asset ID' })
  @IsNotEmpty()
  @IsInt()
  public assetId: number;

  @ApiProperty({ example: 'mainnet', description: 'Network' })
  @IsNotEmpty()
  @IsString()
  public network: string;

  @ApiProperty({ example: Algorithm.MARKET_V2, description: 'Algorithm used for reading' })
  @IsNotEmpty()
  @IsEnum(Algorithm)
  public algorithm: Algorithm;

  @ApiProperty({ example: SourceType.MARKET_V3, description: 'Algorithm used for reading' })
  @IsNotEmpty()
  @IsEnum(SourceType)
  public type: SourceType;

  @ApiProperty({ example: 19876543, description: 'Start block number' })
  @IsNotEmpty()
  @IsNumber()
  public blockNumber: number;

  @ApiPropertyOptional({ example: 'cUSDCv3', description: 'Market name' })
  @IsOptional()
  @IsString()
  public market?: string;
}
