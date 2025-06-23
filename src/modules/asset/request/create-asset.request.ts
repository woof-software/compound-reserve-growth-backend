import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsInt, IsOptional } from 'class-validator';

export class CreateAssetRequest {
  @ApiProperty({ example: '0xdef456', description: 'Token address' })
  @IsNotEmpty()
  @IsString()
  public address: string;

  @ApiProperty({ example: 18, description: 'Token decimals' })
  @IsInt()
  public decimals: number;

  @ApiProperty({ example: 'DAI', description: 'Token symbol' })
  @IsNotEmpty()
  @IsString()
  public symbol: string;

  @ApiProperty({ example: 'ethereum', description: 'Blockchain network' })
  @IsNotEmpty()
  @IsString()
  public network: string;

  @ApiProperty({ example: 'ERC20', description: 'Asset type' })
  @IsOptional()
  @IsString()
  public type?: string;
}
