export type TBullmqJobOptions = {
  removeOnComplete: number;
  removeOnFail: number;
};

export type TBullmqConfig = {
  apiUsageQueue: TBullmqJobOptions;
};

export default (): { bullmq: TBullmqConfig } => ({
  bullmq: {
    apiUsageQueue: {
      removeOnComplete: 5000,
      removeOnFail: 1000,
    },
  },
});
