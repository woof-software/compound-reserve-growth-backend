import { AssetType } from 'modules/asset/enum/asset-type.enum';

import { Algorithm } from 'common/enum/algorithm.enum';

export const sources = [
  {
    algorithm: Algorithm.TIMELOCK,
    address: '0x6d903f6003cca6255D85CcA4D3B5E5146dC33925',
    network: 'mainnet',
    creationBlockNumber: 8722895,
    asset: {
      name: 'ETH',
      address: '0x0000000000000000000000000000000000000000',
      decimals: 18,
      symbol: 'ETH',
      type: AssetType.ETHEREUM,
    },
  },
  {
    algorithm: Algorithm.AVANTGARDE_TREASURY_GROWTH_PROPOSAL,
    address: '0xFDaF45754F372cE8726b10846809878eA53f8c12',
    network: 'mainnet',
    creationBlockNumber: 22444855,
    asset: {
      name: 'Compound',
      address: '0xc00e94Cb662C3520282E6f5717214004A7f26888',
      decimals: 18,
      symbol: 'COMP',
      type: AssetType.COMP,
    },
  },
  {
    algorithm: Algorithm.AVANTGARDE_TREASURY_GROWTH_PROPOSAL,
    address: '0x478f2651Be83731328E9532707714CF91cB229a1',
    network: 'mainnet',
    creationBlockNumber: 22475559,
    asset: {
      name: 'Compound',
      address: '0xc00e94Cb662C3520282E6f5717214004A7f26888',
      decimals: 18,
      symbol: 'COMP',
      type: AssetType.COMP,
    },
  },
  {
    algorithm: Algorithm.AERA_COMPOUND_RESERVES,
    address: '0xc3d688B66703497DAA19211EEdff47f25384cdc3',
    network: 'mainnet',
    creationBlockNumber: 15331586,
    asset: {
      name: 'USD Coin',
      address: '0x8624f61Cc6e5A86790e173712AfDd480fa8b73Ba',
      decimals: 6,
      symbol: 'USDC',
      type: AssetType.STABLECOIN,
    },
  },
  {
    algorithm: Algorithm.AERA_COMPOUND_RESERVES,
    address: '0xA17581A9E3356d9A858b789D68B4d866e593aE94',
    network: 'mainnet',
    creationBlockNumber: 16400710,
    asset: {
      name: 'Wrapped Ether',
      address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      decimals: 18,
      symbol: 'WETH',
      type: AssetType.ETH_CORRELATED,
    },
  },
  {
    algorithm: Algorithm.COMPTROLLER,
    address: '0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B',
    network: 'mainnet',
    creationBlockNumber: 7710671,
    asset: {
      name: 'Compound',
      address: '0xc00e94Cb662C3520282E6f5717214004A7f26888',
      decimals: 18,
      symbol: 'COMP',
      type: AssetType.COMP,
    },
  },
];
