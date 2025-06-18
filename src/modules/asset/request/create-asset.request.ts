import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsInt } from 'class-validator';

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
  public chain: string;

  @ApiProperty({ example: 'ERC20', description: 'Asset type' })
  @IsNotEmpty()
  @IsString()
  public type: string;
}
