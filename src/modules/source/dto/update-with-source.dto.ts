import { Source } from 'modules/source/source.entity';

export class UpdateWithSourceDto {
  public source: Source;
  public blockNumber?: number;
  public checkedAt?: Date;
}
