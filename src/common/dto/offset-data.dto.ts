export class OffsetDataDto<T> {
  constructor(
    public readonly data: T[],
    public readonly limit: number | null,
    public readonly offset: number,
    public readonly total: number,
  ) {}
}
