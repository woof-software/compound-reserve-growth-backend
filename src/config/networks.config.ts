import { registerAs } from '@nestjs/config';

import { NetworkConfig } from 'modules/network/network.types';

export default registerAs('networks', (): NetworkConfig[] => [
  {
    network: 'mainnet',
    chainId: 1,
    //url: `http://18.198.202.237:8545`,
    url: `https://rpc.ankr.com/eth/${process.env.ANKR_KEY}`,
    // ~12.08s blocks -> 75 confirmations ~= 906s (~15m)
    finalityConfirmations: 75,
  },
  {
    network: 'sepolia',
    chainId: 11155111,
    url: `https://rpc.ankr.com/eth_sepolia/${process.env.ANKR_KEY}`,
    // ~12.00s blocks -> 75 confirmations ~= 903s (~15m)
    finalityConfirmations: 75,
  },
  {
    network: 'ronin',
    chainId: 2020,
    url: 'https://ronin.drpc.org',
    // ~3.00s blocks -> 300 confirmations ~= 900s (~15m)
    finalityConfirmations: 300,
  },
  {
    network: 'polygon',
    chainId: 137,
    url: `https://rpc.ankr.com/polygon/${process.env.ANKR_KEY}`,
    // ~2.00s blocks -> 450 confirmations ~= 900s (~15m)
    finalityConfirmations: 450,
  },
  {
    network: 'optimism',
    chainId: 10,
    url: `https://rpc.ankr.com/optimism/${process.env.ANKR_KEY}`,
    // ~2.00s blocks -> 450 confirmations ~= 900s (~15m)
    finalityConfirmations: 450,
  },
  {
    network: 'mantle',
    chainId: 5000,
    url: `https://yolo-side-wildflower.mantle-mainnet.quiknode.pro/${process.env.MANTLE_QUICKNODE_KEY}/`,
    // ~2.00s blocks -> 450 confirmations ~= 900s (~15m)
    finalityConfirmations: 450,
  },
  {
    network: 'unichain',
    chainId: 130,
    url: `https://unichain.drpc.org`,
    // url: `https://multi-boldest-patina.unichain-mainnet.quiknode.pro/${process.env.UNICHAIN_QUICKNODE_KEY}`,
    // ~1.00s blocks -> 900 confirmations ~= 900s (~15m)
    finalityConfirmations: 900,
  },
  {
    network: 'base',
    chainId: 8453,
    url: `https://rpc.ankr.com/base/${process.env.ANKR_KEY}`,
    // ~2.00s blocks -> 450 confirmations ~= 900s (~15m)
    finalityConfirmations: 450,
  },
  {
    network: 'arbitrum',
    chainId: 42161,
    url: `https://rpc.ankr.com/arbitrum/${process.env.ANKR_KEY}`,
    // ~0.250s blocks -> 3590 confirmations ~= 900s (~15m)
    finalityConfirmations: 3590,
  },
  {
    network: 'avalanche',
    chainId: 43114,
    url: 'https://api.avax.network/ext/bc/C/rpc',
    // ~1.00s blocks -> 880 confirmations ~= 900s (~15m)
    finalityConfirmations: 880,
  },
  {
    network: 'fuji',
    chainId: 43113,
    url: 'https://api.avax-test.network/ext/bc/C/rpc',
    // ~2.250s blocks -> 400 confirmations ~= 900s (~15m)
    finalityConfirmations: 400,
  },
  {
    network: 'scroll',
    chainId: 534352,
    url: `https://rpc.ankr.com/scroll/${process.env.ANKR_KEY}`,
    // ~1.20s blocks -> 750 confirmations ~= 901s (~15m)
    finalityConfirmations: 750,
  },
  {
    network: 'linea',
    chainId: 59144,
    url: `https://omniscient-hardworking-gas.linea-mainnet.quiknode.pro/${process.env.LINEA_QUICKNODE_KEY}/`,
    // ~1.90s blocks -> 480 confirmations ~= 901s (~15m)
    finalityConfirmations: 480,
  },
]);
