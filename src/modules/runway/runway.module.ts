import { Module } from '@nestjs/common';

import { RunwayService } from './runway.service';
import { RunwayController } from './runway.controller';

import { ApiKeyGuardModule } from '@/common/guards/api-key';

@Module({
  imports: [ApiKeyGuardModule],
  controllers: [RunwayController],
  providers: [RunwayService],
})
export class RunwayModule {}
