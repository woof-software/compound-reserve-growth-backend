export interface Source {
  id: number;
  address: string;
  network: string;
  market?: string;
  type?: string;
  algorithm: string[];
  blockNumber: number;
  createdAt: Date;
  checkedAt?: Date;
}
