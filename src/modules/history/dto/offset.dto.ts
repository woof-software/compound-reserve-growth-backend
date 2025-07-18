import { Order } from 'common/enum/order.enum';

export class OffsetDto {
  constructor(
    public limit?: number,
    public offset?: number,
    public order?: Order,
    public search?: string,
  ) {}
}
