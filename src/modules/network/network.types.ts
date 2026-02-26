export interface NetworkConfig {
  network: string;
  chainId: number;
  url: string;
  /** Block confirmations for finalized reads (chosen to target ~15 minutes on each network). */
  finalityConfirmations: number;
}
