import { ApiProperty } from '@nestjs/swagger';

export class SyncReservesCursorMetaResponse {
  @ApiProperty({ example: 100 })
  public limit: number;

  @ApiProperty({
    example: '2026-04-07T00:00:00.000Z-501',
    nullable: true,
    description: 'Cursor to use in the next request.',
  })
  public nextCursor: string | null;

  @ApiProperty({ example: true })
  public hasNextPage: boolean;

  constructor(limit: number, nextCursor: string | null, hasNextPage: boolean) {
    this.limit = limit;
    this.nextCursor = nextCursor;
    this.hasNextPage = hasNextPage;
  }
}
