import { HistoryCollectionJobName } from './history-collection.constants';

export type HistoryCollectionSwitchPayload = {
  clearData: boolean;
  data?: string;
};

export type HistoryCollectionDailySyncJobData = {
  requestId: string;
};

export type HistoryCollectionManualJobData = {
  requestId: string;
  collectionSwitch: HistoryCollectionSwitchPayload;
};

export type HistoryCollectionJobDataMap = {
  [HistoryCollectionJobName.DailySync]: HistoryCollectionDailySyncJobData;
  [HistoryCollectionJobName.ReservesCollect]: HistoryCollectionManualJobData;
  [HistoryCollectionJobName.StatsCollect]: HistoryCollectionManualJobData;
};

export type HistoryCollectionJobData =
  HistoryCollectionJobDataMap[keyof HistoryCollectionJobDataMap];
