export interface DailyProcessOutcome {
  lastBlock: number;
  processedDelta: number;
  skippedDelta: number;
  stop: boolean;
}
