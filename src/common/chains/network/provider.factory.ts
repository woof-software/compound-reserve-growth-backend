import { Injectable } from '@nestjs/common';
import { ethers } from 'ethers';
import { MulticallProvider, MulticallWrapper } from 'ethers-multicall-provider';

import { NetworkService } from './network.service';

@Injectable()
export class ProviderFactory {
  private cache = new Map<number, ethers.JsonRpcProvider>();
  private readonly timeoutPatchedProviders = new WeakSet<ethers.JsonRpcProvider>();
  private readonly RPC_TIMEOUT_MS = 30_000;

  constructor(private readonly networkService: NetworkService) {}

  get(identifier: string | number): ethers.JsonRpcProvider {
    const config =
      typeof identifier === 'string'
        ? this.networkService.byName(identifier)
        : this.networkService.byChainId(identifier);

    if (!config) {
      throw new Error(`Unsupported network or chainId: ${identifier}`);
    }

    if (!this.cache.has(config.chainId)) {
      const provider = new ethers.JsonRpcProvider(
        config.url,
        config.chainId,
        config.batchMaxCount ? { batchMaxCount: config.batchMaxCount } : {},
      );
      this.applyRpcTimeout(provider);
      this.cache.set(config.chainId, provider);
    }

    const provider = this.cache.get(config.chainId);
    if (!provider) {
      throw new Error(`Failed to create provider for chainId: ${config.chainId}`);
    }
    return provider;
  }

  multicall(
    identifier: string | number,
    maxMulticallDataLength = 400_000,
  ): MulticallProvider<ethers.JsonRpcProvider> {
    const provider = this.get(identifier);

    if (MulticallWrapper.isMulticallProvider(provider)) {
      provider.maxMulticallDataLength = maxMulticallDataLength;
      return provider;
    }

    const multicallProvider = MulticallWrapper.wrap(provider, maxMulticallDataLength);
    this.applyRpcTimeout(multicallProvider);
    return multicallProvider;
  }

  private applyRpcTimeout(provider: ethers.JsonRpcProvider): void {
    if (this.timeoutPatchedProviders.has(provider)) {
      return;
    }

    const originalGetConnection = provider._getConnection.bind(provider);
    provider._getConnection = () => {
      const connection = originalGetConnection();
      connection.timeout = this.RPC_TIMEOUT_MS;
      return connection;
    };

    this.timeoutPatchedProviders.add(provider);
  }
}
