export interface Source {
  id: number;
  address: string;
  network: string;
  market?: string;
  type?: string;
  algorithm: string[];
  startBlock: number;
  endBlock: number | null;
  createdAt: Date;
  checkedAt?: Date;
  deletedAt?: Date;
}
