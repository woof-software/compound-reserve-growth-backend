import { Injectable, Logger } from '@nestjs/common';
import { ethers } from 'ethers';

import { ProviderFactory } from 'modules/network/provider.factory';

import CometABI from './abi/CometABI.json';
import CometExtensionABI from './abi/CometExtensionABI.json';
import ComptrollerABI from './abi/ComptrollerABI.json';
import MarketV2ABI from './abi/MarketV2ABI.json';
import ERC20ABI from './abi/ERC20ABI.json';
import Bytes32TokenABI from './abi/Bytes32TokenABI.json';
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

  async getCometBaseToken(cometAddress: string, network: string) {
    try {
      const provider = this.providerFactory.get(network);

      const cometContract = new ethers.Contract(cometAddress, CometABI, provider) as any;

      const tokenAddress = await cometContract.baseToken();

      const tokenContract = new ethers.Contract(tokenAddress, ERC20ABI, provider) as any;

      const symbol = await tokenContract.symbol();

      const decimals = await tokenContract.decimals();

      return { address: tokenAddress, symbol, decimals };
    } catch (error) {
      this.logger.error(`Error getting comet ${cometAddress} base token:`, error);
      throw error;
    }
  }

  async getMarketV2UnderlyingToken(marketAddress: string, network: string) {
    try {
      if (marketAddress === '0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5') {
        // NATIVE ETH
        return {
          address: '0x0000000000000000000000000000000000000000',
          symbol: 'ETH',
          decimals: 18,
        };
      }

      const provider = this.providerFactory.get(network);

      const marketContract = new ethers.Contract(marketAddress, MarketV2ABI, provider) as any;

      const tokenAddress = await marketContract.underlying();

      const bytes32Tokens = [
        '0x89d24A6b4CcB1B6fAA2625fE562bDD9a23260359',
        '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2',
      ];

      const tokenABI = bytes32Tokens.includes(tokenAddress) ? Bytes32TokenABI : ERC20ABI;

      const tokenContract = new ethers.Contract(tokenAddress, tokenABI, provider) as any;

      const rawSymbol = await tokenContract.symbol();

      const symbol = bytes32Tokens.includes(tokenAddress)
        ? ethers.toUtf8String(rawSymbol).replace(/\u0000/g, '')
        : rawSymbol;

      const decimals = await tokenContract.decimals();

      return { address: tokenAddress, symbol, decimals };
    } catch (error) {
      this.logger.error(
        `Error getting market v2 ${marketAddress} underlying token in network ${network}:`,
        error,
      );
      throw error;
    }
  }
}
