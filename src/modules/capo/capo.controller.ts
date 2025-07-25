import { Controller, Injectable, Get, Query } from '@nestjs/common';

import { CapoService } from './capo.service';

@Injectable()
@Controller('capo')
export class CapoController {
  constructor(private readonly capoService: CapoService) {}

  @Get('daily')
  async getDailyAggregations(@Query('oracle') oracle?: string) {
    return this.capoService.listDailyAggregations(oracle);
  }
}
