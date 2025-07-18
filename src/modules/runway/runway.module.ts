import { Module } from '@nestjs/common';

import { RunwayService } from './runway.service';
import { RunwayController } from './runway.controller';

@Module({
  controllers: [RunwayController],
  providers: [RunwayService],
})
export class RunwayModule {}
