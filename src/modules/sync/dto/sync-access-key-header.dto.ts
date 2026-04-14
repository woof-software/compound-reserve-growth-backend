import { Exclude, Expose, Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

@Exclude()
export class SyncAccessKeyHeaderDto {
  @Expose({ name: 'x-sync-access-key' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : undefined))
  @IsString({ message: 'X-Sync-Access-Key header must be a string' })
  @IsNotEmpty({ message: 'X-Sync-Access-Key header is required' })
  @MaxLength(512, { message: 'X-Sync-Access-Key header must not exceed 512 characters' })
  public key!: string;
}
