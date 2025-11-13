import { Exclude, Expose, Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

@Exclude()
export class ApiKeyHeaderDto {
  @Expose({ name: 'x-api-key' })
  @Transform(({ value }) => {
    if (Array.isArray(value)) {
      return value[0]?.trim() ?? undefined;
    }

    return typeof value === 'string' ? value.trim() : undefined;
  })
  @IsString({ message: 'X-Api-Key header must be a string' })
  @IsNotEmpty({ message: 'X-Api-Key header is required' })
  @MaxLength(256, { message: 'X-Api-Key header must not exceed 256 characters' })
  @ApiProperty({
    name: 'X-Api-Key',
    type: String,
    required: true,
    example: 'w1X9d2K3m5Q7',
    description: 'Client API key used to authorize access.',
  })
  key: string;
}
