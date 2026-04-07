export type SyncReservesPage<T> = {
  data: T[];
  limit: number;
  nextCursor: string | null;
  hasNextPage: boolean;
};
