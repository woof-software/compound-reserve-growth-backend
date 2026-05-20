export const HISTORY_COLLECTION_QUEUE_NAME = 'history-collection';

export enum HistoryCollectionJobName {
  DailySync = 'history.daily-sync',
  ReservesCollect = 'history.reserves.collect',
  StatsCollect = 'history.stats.collect',
}

export const HISTORY_COLLECTION_JOB_IDS: Record<HistoryCollectionJobName, string> = {
  [HistoryCollectionJobName.DailySync]: 'history-collection-daily-sync',
  [HistoryCollectionJobName.ReservesCollect]: 'history-collection-reserves-collect',
  [HistoryCollectionJobName.StatsCollect]: 'history-collection-stats-collect',
};
