export class CreateSourceDto {
  public address: string;
  public network: string;
  public algorithm: string[];
  public type: string;
  public startBlock: number;
  public endBlock?: number | null;
  public assetId: number;
  public market?: string;
}
