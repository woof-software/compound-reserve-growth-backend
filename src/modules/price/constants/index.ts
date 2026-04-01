export const STABLECOIN_PRICES: Record<string, number> = {
  USDC: 1.0,
  USDT: 1.0,
  DAI: 1.0,
  USDS: 1.0,
  USDbC: 1.0,
  'USD₮0': 1.0,
  TUSD: 1.0,
  USDP: 1.0,
  FEI: 1.0,
  cUSDCv3: 1.0,
  morphoUSDC: 1.0,
  morphoUSDT: 1.0,
  USDe: 1.0,
};

export const USD_QUOTE_ALIASES = new Set([
  'USD',
  'USDC',
  'USDT',
  'USDS',
  'USDBC',
  'USDE',
  'DEUSD',
  'SDEUSD',
  'WUSDM',
  'TUSD',
  'USDP',
  'FEI',
  'USD0',
  'USDT0',
]);

export const ETH_QUOTE_ALIASES = new Set(['ETH', 'WETH']);
export const BTC_QUOTE_ALIASES = new Set(['BTC', 'WBTC']);
export const WSTETH_QUOTE_ALIASES = new Set(['WSTETH']);
export const RON_QUOTE_ALIASES = new Set(['RON', 'WRON']);
