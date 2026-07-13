import { registerAs } from '@nestjs/config';

import { NetworkConfig } from '@/modules/network/network.types';

export default registerAs('networks', (): NetworkConfig[] => [
  {
    network: 'mainnet',
    chainId: 1,
    url: process.env.RPC_MAINNET || `https://rpc.ankr.com/eth/${process.env.ANKR_KEY}`,
    quoteUsdFeeds: {
      ETH: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
      BTC: '0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c',
    },
    wstEthAddress: '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0',
  },
  {
    network: 'sepolia',
    chainId: 11155111,
    url: `https://sepolia.drpc.org`,
  },
  {
    network: 'ronin',
    chainId: 2020,
    url: 'https://ronin.drpc.org',
    batchMaxCount: 3,
    quoteUsdFeeds: {
      RON: '0x0B6074F21488B95945989E513EFEA070096d931D',
    },
  },
  {
    network: 'polygon',
    chainId: 137,
    url: process.env.RPC_POLYGON || `https://rpc.ankr.com/polygon/${process.env.ANKR_KEY}`,
  },
  {
    network: 'optimism',
    chainId: 10,
    url: process.env.RPC_OPTIMISM || `https://rpc.ankr.com/optimism/${process.env.ANKR_KEY}`,
    quoteUsdFeeds: {
      ETH: '0x13e3Ee699D1909E989722E753853AE30b17e08c5',
    },
  },
  {
    network: 'mantle',
    chainId: 5000,
    url: process.env.RPC_MANTLE,
  },
  {
    network: 'unichain',
    chainId: 130,
    url: process.env.RPC_UNICHAIN || 'https://mainnet.unichain.org',
    batchMaxCount: 3,
  },
  {
    network: 'base',
    chainId: 8453,
    url: process.env.RPC_BASE || `https://rpc.ankr.com/base/${process.env.ANKR_KEY}`,
    quoteUsdFeeds: {
      ETH: '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70',
    },
  },
  {
    network: 'arbitrum',
    chainId: 42161,
    url: process.env.RPC_ARBITRUM,
    quoteUsdFeeds: {
      ETH: '0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612',
    },
  },
  {
    network: 'avalanche',
    chainId: 43114,
    url: process.env.RPC_AVALANCHE || 'https://api.avax.network/ext/bc/C/rpc',
    batchMaxCount: 3,
  },
  {
    network: 'fuji',
    chainId: 43113,
    url: 'https://api.avax-test.network/ext/bc/C/rpc',
    batchMaxCount: 3,
  },
  {
    network: 'scroll',
    chainId: 534352,
    url: process.env.RPC_SCROLL || `https://scroll-rpc.publicnode.com`,
  },
  {
    network: 'linea',
    chainId: 59144,
    url: process.env.RPC_LINEA,
    quoteUsdFeeds: {
      ETH: '0x3c6Cd9Cc7c7a4c2Cf5a82734CD249D7D593354dA',
    },
  },
]);
