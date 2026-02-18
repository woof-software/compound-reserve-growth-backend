import { AssetEntity } from 'modules/asset/asset.entity';

export class CreateSourceWithAssetDto {
  public address: string;
  public network: string;
  public algorithm: string[];
  public type: string;
  public startBlock: number;
  public endBlock?: number | null;
  public asset: AssetEntity;
  public market?: string;
}
