import { IsString, IsArray, IsOptional, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateApiKeyDto {
  @ApiPropertyOptional({ description: 'Client name (max 24 characters)', maxLength: 24 })
  @IsOptional()
  @IsString()
  @MaxLength(24)
  clientName?: string;

  @ApiPropertyOptional({ description: 'IP whitelist', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ipWhitelist?: string[];

  @ApiPropertyOptional({ description: 'Domain whitelist', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  domainWhitelist?: string[];
}
