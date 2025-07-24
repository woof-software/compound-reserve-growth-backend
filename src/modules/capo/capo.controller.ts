import { Controller, Injectable } from '@nestjs/common';

import { CapoService } from './capo.service';

@Injectable()
@Controller('capo')
export class CapoController {
  constructor(private readonly capoService: CapoService) {}
}
