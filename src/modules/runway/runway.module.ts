import { Module } from '@nestjs/common';

import { RunwayService } from './runway.service';
import { RunwayController } from './runway.controller';
import { ApiKeyModule } from 'modules/api-key/api-key.module';

@Module({
  imports: [ApiKeyModule],
  controllers: [RunwayController],
  providers: [RunwayService],
})
export class RunwayModule {}
