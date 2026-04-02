import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';

import { NetworkConfig } from './network.types';

import networksConfig from '@/config/networks.config';

@Injectable()
export class NetworkService {
  constructor(
    @Inject(networksConfig.KEY)
    private readonly networks: ConfigType<typeof networksConfig>,
  ) {}

  all(): NetworkConfig[] {
    return this.networks;
  }

  byName(name: string): NetworkConfig {
    const network = this.networks.find((item) => item.network === name);
    if (!network) {
      throw new BadRequestException(`Network "${name}" is not configured`);
    }

    return network;
  }

  byChainId(chainId: number): NetworkConfig {
    const network = this.networks.find((item) => item.chainId === chainId);
    if (!network) {
      throw new BadRequestException(`ChainId "${chainId}" is not configured`);
    }

    return network;
  }
}
