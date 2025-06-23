import { Asset } from 'modules/asset/asset.entity';

export class CreateSourceWithAssetDto {
  public address: string;
  public network: string;
  public algorithm: string;
  public blockNumber: number;
  public asset: Asset;
  public market?: string;
}
