import { Injectable, Logger } from '@nestjs/common';

import { ContractService } from 'modules/contract/contract.service';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  constructor(private readonly contractsService: ContractService) {}
}
