import { Injectable, Logger } from '@nestjs/common';
import { ethers } from 'ethers';

import { ProviderFactory } from 'modules/network/provider.factory';

import CometABI from './abi/CometABI.json';
import CometExtensionABI from './abi/CometExtensionABI.json';
import ComptrollerABI from './abi/ComptrollerABI.json';
import MarketV2ABI from './abi/MarketV2ABI.json';
import { MarketData, RootJson } from './contract.type';

@Injectable()
export class ContractService {
  private readonly logger = new Logger(ContractService.name);

  constructor(private readonly providerFactory: ProviderFactory) {}

  async readMarketData(root: RootJson, networkPath: string): Promise<MarketData> {
    const [networkKey] = networkPath.split('/');
    if (!networkKey) {
      this.logger.error(
        `Invalid networkPath format: '${root.networkPath}'. Expected format: 'network/market'`,
      );
      throw new Error(`Invalid networkPath format: '${root.networkPath}'`);
    }

    let provider: ethers.JsonRpcProvider;
    try {
      provider = this.providerFactory.get(networkKey);
    } catch (e) {
      this.logger.error(`Unsupported network '${networkKey}' in path '${root.networkPath}'`);
      throw e;
    }

    const cometAddress = root.comet;
    const cometContract = new ethers.Contract(cometAddress, CometABI, provider) as any;

    const extensionDelegateAddress = await cometContract.extensionDelegate();
    const extensionDelegateContract = new ethers.Contract(
      extensionDelegateAddress,
      CometExtensionABI,
      provider,
    ) as any;

    const cometSymbol = await extensionDelegateContract.symbol();

    return {
      network: networkKey,
      market: cometSymbol,
      cometAddress,
    };
  }

  async getContractCreationBlock(contractAddress: string, network: string): Promise<number> {
    try {
      const provider = this.providerFactory.get(network);
      const currentBlock = await provider.getBlockNumber();
      let left = 0;
      let right = currentBlock;

      while (left < right) {
        const mid = Math.floor((left + right) / 2);
        const code = await provider.getCode(contractAddress, mid);

        if (code === '0x') {
          left = mid + 1;
        } else {
          right = mid;
        }
      }

      this.logger.log(`Contract ${contractAddress} was created at block ${left}`);
      return left;
    } catch (error) {
      this.logger.error(`Error finding creation block for ${contractAddress}:`, error);
      throw error;
    }
  }

  async getAllComptrollerMarkets(comptrollerAddress: string, network: string): Promise<string[]> {
    try {
      const provider = this.providerFactory.get(network);

      const comptrollerContract = new ethers.Contract(
        comptrollerAddress,
        ComptrollerABI,
        provider,
      ) as any;

      const allMarkets = await comptrollerContract.getAllMarkets();

      return allMarkets;
    } catch (error) {
      this.logger.error(`Error finding comptroller markets for ${comptrollerAddress}:`, error);
      throw error;
    }
  }

  async getMarketSymbol(marketAddress: string, network: string): Promise<string> {
    try {
      const provider = this.providerFactory.get(network);

      const marketContract = new ethers.Contract(marketAddress, MarketV2ABI, provider) as any;

      const symbol = await marketContract.symbol();

      return symbol;
    } catch (error) {
      this.logger.error(`Error finding market symbol for ${marketAddress}:`, error);
      throw error;
    }
  }
}
