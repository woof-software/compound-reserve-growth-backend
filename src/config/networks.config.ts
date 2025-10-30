import { registerAs } from '@nestjs/config';

import { NetworkConfig } from 'modules/network/network.types';

export default registerAs('networks', (): NetworkConfig[] => [
  {
    network: 'mainnet',
    chainId: 1,
    //url: `http://18.198.202.237:8545`,
    url: process.env.JSON_RPC_ETHEREUM,
  },
  {
    network: 'sepolia',
    chainId: 11155111,
    url: process.env.JSON_RPC_SEPOLIA,
  },
  {
    network: 'ronin',
    chainId: 2020,
    url: process.env.JSON_RPC_RONIN,
  },
  {
    network: 'polygon',
    chainId: 137,
    url: process.env.JSON_RPC_POLYGON,
  },
  {
    network: 'optimism',
    chainId: 10,
    url: process.env.JSON_RPC_OPTIMISM,
  },
  {
    network: 'mantle',
    chainId: 5000,
    url: process.env.JSON_RPC_MANTLE,
  },
  {
    network: 'unichain',
    chainId: 130,
    url: process.env.JSON_RPC_UNICHAIN,
  },
  {
    network: 'base',
    chainId: 8453,
    url: process.env.JSON_RPC_BASE,
  },
  {
    network: 'arbitrum',
    chainId: 42161,
    url: process.env.JSON_RPC_ARBITRUM,
  },
  {
    network: 'avalanche',
    chainId: 43114,
    url: process.env.JSON_RPC_AVALANCHE,
  },
  {
    network: 'fuji',
    chainId: 43113,
    url: process.env.JSON_RPC_FUJI,
  },
  {
    network: 'scroll',
    chainId: 534352,
    url: process.env.JSON_RPC_SCROLL,
  },
  {
    network: 'linea',
    chainId: 59144,
    url: process.env.JSON_RPC_LINEA,
  },
]);
