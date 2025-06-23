import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class CreateRevenueRequest {
  @ApiProperty({ example: 1, description: 'Source ID' })
  @IsNotEmpty()
  @IsInt()
  public sourceId: number;

  @ApiProperty({ example: 20123456, description: 'Block number' })
  @IsNotEmpty()
  @IsInt()
  public blockNumber: number;

  @ApiProperty({ example: '1001233245', description: 'Quantity' })
  @IsNotEmpty()
  @IsString()
  public quantity: string;

  @ApiProperty({ example: 1.05, description: 'Price in USD' })
  @IsNotEmpty()
  @IsNumber()
  public price: number;

  @ApiProperty({ example: 105.525, description: 'Value in USD' })
  @IsNotEmpty()
  @IsNumber()
  public value: number;

  @ApiProperty({ example: '2025-06-17T12:00:00Z', description: 'Date of the revenue entry' })
  @IsNotEmpty()
  public date: Date;
}
