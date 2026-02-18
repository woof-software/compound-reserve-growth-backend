import { SourceEntity } from 'modules/source/source.entity';

export class UpdateWithSourceDto {
  public source: SourceEntity;
  public startBlock?: number;
  public endBlock?: number | null;
  public checkedAt?: Date;
}
