import { ApiProperty } from '@nestjs/swagger';

export class OffsetMetaResponse {
  @ApiProperty({
    example: 1,
  })
  readonly limit: number | null;

  @ApiProperty({
    example: 20,
  })
  readonly offset: number;

  @ApiProperty({
    example: 777,
  })
  readonly total: number;

  constructor(limit: number | null, offset: number, total: number) {
    this.limit = limit;
    this.offset = offset;
    this.total = total;
  }
}
