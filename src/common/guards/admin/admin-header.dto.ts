import { Exclude, Expose, Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

@Exclude()
export class AdminHeaderDto {
  @Expose({ name: 'x-admin-token' })
  @Transform(({ value }) => {
    if (Array.isArray(value)) {
      return value[0]?.trim() ?? undefined;
    }

    return typeof value === 'string' ? value.trim() : undefined;
  })
  @IsString({ message: 'X-Admin-Token header must be a string' })
  @IsNotEmpty({ message: 'X-Admin-Token header is required' })
  @MaxLength(512, { message: 'X-Admin-Token header must not exceed 512 characters' })
  @ApiProperty({
    name: 'X-Admin-Token',
    type: String,
    required: true,
    example: 's3cr3tAdm1nT0k3n',
    description: 'Administrative access token sent with each request.',
  })
  token: string;
}
