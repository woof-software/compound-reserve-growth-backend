export interface NetworkConfig {
  network: string;
  chainId: number;
  url: string;
  /** Block lag for reorg-resilient reads (targeting ~15 minutes per network). */
  finalityConfirmations: number;
}
