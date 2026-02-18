export class UpdateSourceDto {
  public id: number;
  public startBlock?: number;
  public endBlock?: number | null;
  public checkedAt?: Date;
}
