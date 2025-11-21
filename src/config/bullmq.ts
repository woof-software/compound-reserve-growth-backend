export type BullmqJobOptions = {
  removeOnComplete: number;
  removeOnFail: number;
};

export type BullmqConfig = {
  apiUsageQueue: BullmqJobOptions;
};

export default (): { bullmq: BullmqConfig } => ({
  bullmq: {
    apiUsageQueue: {
      removeOnComplete: 5000,
      removeOnFail: 1000,
    },
  },
});
