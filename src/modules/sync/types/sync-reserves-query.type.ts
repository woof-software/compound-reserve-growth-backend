export type SyncReservesQuery = {
  limit: number;
  cursorUpdatedAt?: Date;
  cursorId?: number;
  excludedNetworks?: string[];
};
