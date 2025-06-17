import { IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

import { PaginationMetaResponse } from './pagination-meta.response';

export class PaginatedDataResponse<T> {
  @IsArray()
  @ApiProperty({ isArray: true })
  readonly data: T[];

  @ApiProperty({ type: () => PaginationMetaResponse })
  readonly meta: PaginationMetaResponse;

  constructor(data: T[], meta: PaginationMetaResponse) {
    this.data = data;
    this.meta = meta;
  }
}
