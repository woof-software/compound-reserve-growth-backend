import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Worker } from 'bullmq';

import { GetHistoryService } from 'modules/history/cron/history-get.service';
import { HistoryCollectionRequest } from 'modules/history/types/history-collection-request.type';

import {
  HISTORY_COLLECTION_QUEUE_NAME,
  HistoryCollectionJobName,
} from './history-collection.constants';
import { createHistoryCollectionConnection } from './history-collection.connection';
import { HistoryCollectionQueueService } from './history-collection-queue.service';
import {
  HistoryCollectionJobData,
  HistoryCollectionJobDataMap,
  HistoryCollectionSwitchPayload,
} from './history-collection.types';

type HistoryCollectionJob = {
  [Name in HistoryCollectionJobName]: Job<HistoryCollectionJobDataMap[Name], void, Name>;
}[HistoryCollectionJobName];

const deserializeCollectionSwitch = (
  collectionSwitch: HistoryCollectionSwitchPayload,
): HistoryCollectionRequest => {
  const result = {
    clearData: collectionSwitch.clearData,
  };

  if (collectionSwitch.data) {
    return {
      ...result,
      data: new Date(collectionSwitch.data),
    };
  }

  return result;
};

@Injectable()
export class HistoryCollectionWorkerService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(HistoryCollectionWorkerService.name);
  private worker: Worker<HistoryCollectionJobData, void, HistoryCollectionJobName> | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly getHistoryService: GetHistoryService,
    private readonly historyCollectionQueueService: HistoryCollectionQueueService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.historyCollectionQueueService.clearQueue();

    this.worker = new Worker<HistoryCollectionJobData, void, HistoryCollectionJobName>(
      HISTORY_COLLECTION_QUEUE_NAME,
      async (job) => {
        await this.processJob(job as HistoryCollectionJob);
      },
      {
        connection: createHistoryCollectionConnection(this.configService),
        concurrency: 1,
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`History collection job completed name=${job.name} id=${job.id}`);
    });

    this.worker.on('failed', (job, error) => {
      this.logger.error(
        `History collection job failed name=${job?.name ?? 'unknown'} id=${job?.id ?? 'unknown'} error=${error.message}`,
        error.stack,
      );
    });
  }

  async onApplicationShutdown(): Promise<void> {
    if (!this.worker) {
      return;
    }

    await this.worker.close();
    this.worker = null;
  }

  private async processJob(job: HistoryCollectionJob): Promise<void> {
    switch (job.name) {
      case HistoryCollectionJobName.DailySync:
        await this.getHistoryService.getHistory();
        return;
      case HistoryCollectionJobName.ReservesCollect:
        await this.getHistoryService.startReservesProcessing(
          deserializeCollectionSwitch(job.data.collectionSwitch),
        );
        return;
      case HistoryCollectionJobName.StatsCollect:
        await this.getHistoryService.startStatsProcessing(
          deserializeCollectionSwitch(job.data.collectionSwitch),
        );
        return;
    }
  }
}
