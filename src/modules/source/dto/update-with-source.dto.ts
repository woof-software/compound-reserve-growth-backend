import { SourceEntity } from 'modules/source/source.entity';

export class UpdateWithSourceDto {
  public source: SourceEntity;
  public blockNumber?: number;
  public checkedAt?: Date;
}
