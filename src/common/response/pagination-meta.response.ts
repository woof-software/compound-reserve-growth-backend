import { ApiProperty } from '@nestjs/swagger';

export class PaginationMetaResponse {
  @ApiProperty({
    example: 1,
  })
  readonly page: number;

  @ApiProperty({
    example: 20,
  })
  readonly perPage: number;

  @ApiProperty({
    example: 777,
  })
  readonly total: number;

  constructor(page: number, perPage: number, total: number) {
    this.page = page;
    this.perPage = perPage;
    this.total = total;
  }
}
