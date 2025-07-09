import { IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

import { OffsetnMetaResponse } from './offset-meta.response';

export class OffsetDataResponse<T> {
  @IsArray()
  @ApiProperty({ isArray: true })
  readonly data: T[];

  @ApiProperty({ type: () => OffsetnMetaResponse })
  readonly meta: OffsetnMetaResponse;

  constructor(data: T[], meta: OffsetnMetaResponse) {
    this.data = data;
    this.meta = meta;
  }
}
