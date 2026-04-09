export type SyncReservesPage<T> = {
  data: T[];
  limit: number;
  lastItemCursor: string | null;
  hasNextPage: boolean;
};
