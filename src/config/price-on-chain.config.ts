import { registerAs } from '@nestjs/config';

export type QuoteUsdFeedsConfig = {
  ETH: Partial<Record<string, string>>;
  BTC: Partial<Record<string, string>>;
  RON: Partial<Record<string, string>>;
};

export type PriceOnChainConfig = {
  quoteUsdFeeds: QuoteUsdFeedsConfig;
  quoteFeedFallbackNetwork: Partial<Record<'ETH' | 'BTC', string>>;
  wstEth: {
    mainnetAddress: string;
  };
};

export default registerAs(
  'priceOnChain',
  (): PriceOnChainConfig => ({
    quoteUsdFeeds: {
      ETH: {
        mainnet: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
        optimism: '0x13e3Ee699D1909E989722E753853AE30b17e08c5',
        base: '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70',
        arbitrum: '0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612',
        linea: '0x3c6Cd9Cc7c7a4c2Cf5a82734CD249D7D593354dA',
      },
      BTC: {
        mainnet: '0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c',
      },
      RON: {
        ronin: '0x0B6074F21488B95945989E513EFEA070096d931D',
      },
    },
    quoteFeedFallbackNetwork: {
      ETH: 'mainnet',
      BTC: 'mainnet',
    },
    wstEth: {
      mainnetAddress: '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0',
    },
  }),
);
