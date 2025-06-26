import { Order } from 'common/enum/order.enum';

export class PaginationDto {
  constructor(
    public page?: number,
    public perPage?: number,
    public order?: Order,
    public search?: string,
  ) {}
}
