import { ethers } from 'ethers';

export interface RootJson {
  comet: string; // Comet contract address
  configurator: string; // Configurator contract address
  rewards: string; // (optional) Rewards contract address
  bulker: string; // (optional) Bulker contract address
  bridgeReceiver?: string; // (optional) BridgeReceiver contract address
  [key: string]: any;
}

/**
 * Single contract entry with its name, on‐chain address, and GitHub link.
 */
export interface ContractEntry {
  name: string;
  address: string;
  githubContract?: string;
}

/**
 * All the contracts defined in roots.json for a Comet market.
 */
export interface ContractsMap {
  comet: string;
  cometImplementation: string;
  cometExtension: string;
  configurator: string;
  configuratorImplementation: string;
  cometAdmin: string;
  cometFactory: string;
  rewards: string;
  bulker: string;
  governor: string;
  timelock: string;
}

export interface NetworkCompBalanceRecord {
  idx: number;
  date: string; // ISO date or "Date of record"
  network: string; // e.g. "Arbitrum"
  currentCompBalance: number; // e.g. "100 COMP"
}

export interface NetworkCompBalanceTable {
  networks: NetworkCompBalanceRecord[];
  totalCompBalance: number; // total COMP balance across all networks
}

export interface MarketData {
  network: string;
  market: string;
  cometAddress: string;
  rewardsAddress?: string; // optional, if not present, rewards are not used
  provider: ethers.JsonRpcProvider;
}
