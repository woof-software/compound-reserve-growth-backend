import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsNumber } from 'class-validator';

export class CreateSourceRequest {
  @ApiProperty({ example: '0xabc123', description: 'Source address' })
  @IsNotEmpty()
  @IsString()
  public address: string;

  @ApiProperty({ example: 'mainnet', description: 'Network' })
  @IsNotEmpty()
  @IsString()
  public network: string;

  @ApiPropertyOptional({ example: 'cUSDCv3', description: 'Market name' })
  @IsOptional()
  @IsString()
  public market?: string;

  @ApiProperty({ example: 'subgraph', description: 'Algorithm used for reading' })
  @IsNotEmpty()
  @IsString()
  public algorithm: string;

  @ApiProperty({ example: 19876543, description: 'Start block number' })
  @IsNotEmpty()
  @IsNumber()
  public blockNumber: number;
}
