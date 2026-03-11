import { randomUUID } from 'node:crypto';

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';

import { HistoryCollectionRequest } from 'modules/history/types/history-collection-request.type';

import {
  HISTORY_COLLECTION_QUEUE_NAME,
  HISTORY_COLLECTION_SINGLETON_JOB_ID,
  HistoryCollectionJobName,
} from './history-collection.constants';
import { createHistoryCollectionConnection } from './history-collection.connection';
import {
  HistoryCollectionJobData,
  HistoryCollectionJobDataMap,
  HistoryCollectionManualJobData,
  HistoryCollectionSwitchPayload,
} from './history-collection.types';

const createDailySyncJobData = (
  requestId: string,
): HistoryCollectionJobDataMap[HistoryCollectionJobName.DailySync] => ({
  requestId,
});

const createManualCollectionJobData = (
  requestId: string,
  collectionSwitch: HistoryCollectionRequest,
): HistoryCollectionManualJobData => ({
  requestId,
  collectionSwitch: serializeCollectionSwitch(collectionSwitch),
});

const serializeCollectionSwitch = (
  collectionSwitch: HistoryCollectionRequest,
): HistoryCollectionSwitchPayload => {
  const payload: HistoryCollectionSwitchPayload = {
    clearData: collectionSwitch.clearData ?? false,
  };

  if (collectionSwitch.data) {
    payload.data = collectionSwitch.data.toISOString();
  }

  return payload;
};

@Injectable()
export class HistoryCollectionQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(HistoryCollectionQueueService.name);
  private readonly queue: Queue<
    HistoryCollectionJobData,
    void,
    HistoryCollectionJobName,
    HistoryCollectionJobData,
    void,
    HistoryCollectionJobName
  >;

  constructor(private readonly configService: ConfigService) {
    this.queue = new Queue<
      HistoryCollectionJobData,
      void,
      HistoryCollectionJobName,
      HistoryCollectionJobData,
      void,
      HistoryCollectionJobName
    >(HISTORY_COLLECTION_QUEUE_NAME, {
      connection: createHistoryCollectionConnection(this.configService),
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: true,
      },
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }

  async clearQueue(): Promise<void> {
    await this.queue.obliterate({ force: true });
    this.logger.log('History collection queue was cleared');
  }

  async enqueueDailySync(): Promise<boolean> {
    return this.enqueueSingletonJob(
      HistoryCollectionJobName.DailySync,
      createDailySyncJobData(randomUUID()),
    );
  }

  async enqueueReservesCollection(collectionSwitch: HistoryCollectionRequest): Promise<boolean> {
    return this.enqueueSingletonJob(
      HistoryCollectionJobName.ReservesCollect,
      createManualCollectionJobData(randomUUID(), collectionSwitch),
    );
  }

  async enqueueStatsCollection(collectionSwitch: HistoryCollectionRequest): Promise<boolean> {
    return this.enqueueSingletonJob(
      HistoryCollectionJobName.StatsCollect,
      createManualCollectionJobData(randomUUID(), collectionSwitch),
    );
  }

  private async enqueueSingletonJob<Name extends HistoryCollectionJobName>(
    jobName: Name,
    jobData: HistoryCollectionJobDataMap[Name],
  ): Promise<boolean> {
    const counts = await this.queue.getJobCounts(
      'active',
      'waiting',
      'delayed',
      'prioritized',
      'paused',
      'waiting-children',
    );

    const hasBlockingJobs = Object.values(counts).some((value) => value > 0);
    if (hasBlockingJobs) {
      this.logger.warn(`History collection job ${jobName} was blocked - another job is running`);
      return false;
    }

    const job = await this.queue.add(jobName, jobData, {
      jobId: HISTORY_COLLECTION_SINGLETON_JOB_ID,
    });

    const wasEnqueuedByCurrentRequest = job.data.requestId === jobData.requestId;
    if (!wasEnqueuedByCurrentRequest) {
      this.logger.warn(`History collection job ${jobName} was blocked by a concurrent enqueue`);
    }

    return wasEnqueuedByCurrentRequest;
  }
}
