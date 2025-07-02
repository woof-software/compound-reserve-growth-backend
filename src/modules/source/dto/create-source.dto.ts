export class CreateSourceDto {
  public address: string;
  public network: string;
  public algorithm: string;
  public type: string;
  public blockNumber: number;
  public assetId: number;
  public market?: string;
}
