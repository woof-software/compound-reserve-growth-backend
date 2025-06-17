export class PaginatedDataDto<T> {
  constructor(
    public readonly data: T[],
    public readonly page: number,
    public readonly perPage: number,
    public readonly total: number,
  ) {}
}
