export const HISTORY_COLLECTION_QUEUE_NAME = 'history-collection';
export const HISTORY_COLLECTION_SINGLETON_JOB_ID = 'history-collection-singleton';

export enum HistoryCollectionJobName {
  DailySync = 'history.daily-sync',
  ReservesCollect = 'history.reserves.collect',
  StatsCollect = 'history.stats.collect',
}
