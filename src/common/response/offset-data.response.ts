import { IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

import { OffsetMetaResponse } from './offset-meta.response';

export class OffsetDataResponse<T> {
  @IsArray()
  @ApiProperty({ isArray: true })
  readonly data: T[];

  @ApiProperty({ type: () => OffsetMetaResponse })
  readonly meta: OffsetMetaResponse;

  constructor(data: T[], meta: OffsetMetaResponse) {
    this.data = data;
    this.meta = meta;
  }
}
