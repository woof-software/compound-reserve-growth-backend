import { MulticallWrapper } from 'ethers-multicall-provider';

import { ProviderFactory } from '@/common/chains/network/provider.factory';
import { NetworkConfig } from '@/common/chains/network/network.types';

describe('ProviderFactory', () => {
  const makeFactory = (overrides: Partial<NetworkConfig> = {}) => {
    const config: NetworkConfig = {
      network: 'mainnet',
      chainId: 1,
      url: 'http://localhost:8545',
      ...overrides,
    };

    const networkService = {
      byName: jest.fn((name: string) => (name === config.network ? config : undefined)),
      byChainId: jest.fn((chainId: number) => (chainId === config.chainId ? config : undefined)),
    };

    const factory = new ProviderFactory(networkService as never);
    return { factory };
  };

  it('returns cached provider for get() and wraps the same instance for multicall()', () => {
    const { factory } = makeFactory();

    const first = factory.get('mainnet');
    const second = factory.get(1);

    expect(first).toBe(second);
    expect(MulticallWrapper.isMulticallProvider(first)).toBe(false);

    const multicallProvider = factory.multicall('mainnet');
    expect(multicallProvider).toBe(first);
    expect(MulticallWrapper.isMulticallProvider(multicallProvider)).toBe(true);
  });

  it('applies max calldata override for multicall()', () => {
    const { factory } = makeFactory();

    const provider = factory.multicall('mainnet', 123_456);
    expect(provider.maxMulticallDataLength).toBe(123_456);
  });
});
