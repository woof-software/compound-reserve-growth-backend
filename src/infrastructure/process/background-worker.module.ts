import { Module } from '@nestjs/common';

import { BackgroundWorkerChildProcessService } from './background-worker-child-process.service';

@Module({
  providers: [BackgroundWorkerChildProcessService],
})
export class BackgroundWorkerModule {}
