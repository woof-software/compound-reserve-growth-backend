import { Injectable } from '@nestjs/common';
import { ethers } from 'ethers';

import ComptrollerABI from 'modules/contract/abi/ComptrollerABI.json';
import ERC20ABI from 'modules/contract/abi/ERC20ABI.json';
import { ResponseStatsAlgorithm } from 'modules/contract/interface';

import { MARKET_DECIMALS, YEAR_IN_DAYS, YEAR_IN_SECONDS } from '@/common/constants';
import { scaleToDecimals } from '@/common/utils/scale-to-decimals';

@Injectable()
export class AlgorithmService {
  constructor() {}

  public async comet(contract: ethers.Contract, blockTag: number): Promise<bigint> {
    return contract.getReserves({ blockTag });
  }

  public async marketV2(contract: ethers.Contract, blockTag: number): Promise<bigint> {
    return contract.totalReserves({ blockTag });
  }

  public async cometStats(
    contract: ethers.Contract,
    blockTag: number,
    decimals: number,
    priceComp: number,
  ): Promise<ResponseStatsAlgorithm> {
    const totalSupply: bigint = await contract.totalSupply({ blockTag });
    const totalBorrows: bigint = await contract.totalBorrow({ blockTag });
    const utilization: bigint = await contract.getUtilization({ blockTag });
    const supplyRatePerSec: bigint = await contract.getSupplyRate(utilization, { blockTag });
    const borrowRatePerSec: bigint = await contract.getBorrowRate(utilization, { blockTag });
    const trackingIndexScale: bigint = await contract.trackingIndexScale({ blockTag });
    const trackingIndexDecimals = scaleToDecimals(trackingIndexScale);
    const earnApr = Number(
      ethers.formatUnits(supplyRatePerSec * BigInt(YEAR_IN_SECONDS) * 100n, MARKET_DECIMALS),
    );
    const borrowApr = Number(
      ethers.formatUnits(borrowRatePerSec * BigInt(YEAR_IN_SECONDS) * 100n, MARKET_DECIMALS),
    );

    const baseTrackingSupplySpeed: bigint = await contract.baseTrackingSupplySpeed({
      blockTag,
    });
    const baseTrackingBorrowSpeed: bigint = await contract.baseTrackingBorrowSpeed({
      blockTag,
    });
    const annualSupplyRewardCompTokens = Number(
      ethers.formatUnits(baseTrackingSupplySpeed * BigInt(YEAR_IN_SECONDS), trackingIndexDecimals),
    );
    const annualBorrowRewardCompTokens = Number(
      ethers.formatUnits(baseTrackingBorrowSpeed * BigInt(YEAR_IN_SECONDS), trackingIndexDecimals),
    );
    const supplyRewardsUSD = annualSupplyRewardCompTokens * priceComp;
    const borrowRewardsUSD = annualBorrowRewardCompTokens * priceComp;

    const totalSupplyTokens = Number(ethers.formatUnits(totalSupply, decimals));
    const totalBorrowsTokens = Number(ethers.formatUnits(totalBorrows, decimals));
    const supplyIncome = (totalSupplyTokens * earnApr) / 100;
    const borrowIncome = (totalBorrowsTokens * borrowApr) / 100;

    return {
      incomes: {
        supply: supplyIncome,
        borrow: borrowIncome,
      },
      spends: { supplyUsd: supplyRewardsUSD, borrowUsd: borrowRewardsUSD },
    };
  }

  public async marketV2Stats(
    contract: ethers.Contract,
    blockTag: number,
    blocksPerDay: number,
    decimals: number,
    provider: ethers.JsonRpcProvider,
    contractAddress: string,
    priceComp: number,
  ): Promise<ResponseStatsAlgorithm> {
    const totalSupply = await contract.totalSupply({ blockTag });
    const exchangeRate = await contract.exchangeRateStored({ blockTag });
    const totalBorrows = await contract.totalBorrows({ blockTag });
    const supplyRatePerBlock: bigint = await contract.supplyRatePerBlock({ blockTag });
    const borrowRatePerBlock: bigint = await contract.borrowRatePerBlock({ blockTag });
    const blocksPerYear = BigInt(blocksPerDay) * BigInt(YEAR_IN_DAYS);
    const earnApr = Number(
      ethers.formatUnits(supplyRatePerBlock * blocksPerYear * 100n, MARKET_DECIMALS),
    );
    const borrowApr = Number(
      ethers.formatUnits(borrowRatePerBlock * blocksPerYear * 100n, MARKET_DECIMALS),
    );
    const comptrollerAddress = await contract.comptroller({ blockTag });
    const comptroller = new ethers.Contract(comptrollerAddress, ComptrollerABI, provider);
    const compAddress = await comptroller.getCompAddress();
    const compSupplySpeedPerBlock: bigint = await comptroller.compSupplySpeeds(contractAddress, {
      blockTag,
    });
    const compSpeedBorrowPerBlock: bigint = await comptroller.compBorrowSpeeds(contractAddress, {
      blockTag,
    });
    const compTokenContract = new ethers.Contract(compAddress, ERC20ABI, provider);
    const compDecimals: number = await compTokenContract.decimals();
    const compSupplyPerYearWei: bigint = compSupplySpeedPerBlock * blocksPerYear;
    const compBorrowPerYearWei: bigint = compSpeedBorrowPerBlock * blocksPerYear;
    const compSupplyPerYearCompTokens = Number(
      ethers.formatUnits(compSupplyPerYearWei, compDecimals),
    );
    const compBorrowPerYearCompTokens = Number(
      ethers.formatUnits(compBorrowPerYearWei, compDecimals),
    );
    const totalBorrowsTokens = Number(ethers.formatUnits(totalBorrows, decimals));
    const totalSupplyCTokens = Number(ethers.formatUnits(totalSupply, decimals));
    const exchangeRateConvertor = ethers.formatUnits(exchangeRate, MARKET_DECIMALS);
    const totalSupplyTokens = Number(totalSupplyCTokens) * Number(exchangeRateConvertor);
    const supplyRewardsUSD = compSupplyPerYearCompTokens * priceComp;
    const borrowRewardsUSD = compBorrowPerYearCompTokens * priceComp;

    const supplyIncome = (totalSupplyTokens * earnApr) / 100;
    const borrowIncome = (totalBorrowsTokens * borrowApr) / 100;

    return {
      incomes: {
        supply: supplyIncome,
        borrow: borrowIncome,
      },
      spends: { supplyUsd: supplyRewardsUSD, borrowUsd: borrowRewardsUSD },
    };
  }
}
