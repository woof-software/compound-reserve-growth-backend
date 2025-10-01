import { Injectable } from '@nestjs/common';
import { ethers } from 'ethers';

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
      spends: {
        supplyComp: annualSupplyRewardCompTokens,
        supplyUsd: supplyRewardsUSD,
        borrowComp: annualBorrowRewardCompTokens,
        borrowUsd: borrowRewardsUSD,
      },
    };
  }

  public async marketV2Stats(
    contract: ethers.Contract,
    blockTag: number,
    blocksPerDay: number,
    decimals: number,
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
    const totalBorrowsTokens = Number(ethers.formatUnits(totalBorrows, decimals));
    const totalSupplyCTokens = Number(ethers.formatUnits(totalSupply, decimals));
    const exchangeRateConvertor = ethers.formatUnits(exchangeRate, MARKET_DECIMALS);
    const totalSupplyTokens = Number(totalSupplyCTokens) * Number(exchangeRateConvertor);

    const supplyIncome = (totalSupplyTokens * earnApr) / 100;
    const borrowIncome = (totalBorrowsTokens * borrowApr) / 100;

    return {
      incomes: {
        supply: supplyIncome,
        borrow: borrowIncome,
      },
    };
  }
}
