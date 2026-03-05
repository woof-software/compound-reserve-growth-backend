import { Injectable } from '@nestjs/common';
import { ethers } from 'ethers';

import { ResponseStatsAlgorithm } from 'modules/contract/interface';

import { dailyIncomeTokens, dailySpendUsd } from './math';

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
    const [
      totalSupply,
      totalBorrow,
      utilization,
      trackingIndexScale,
      baseTrackingSupplySpeed,
      baseTrackingBorrowSpeed,
    ] = await Promise.all([
      contract.totalSupply({ blockTag }) as Promise<bigint>,
      contract.totalBorrow({ blockTag }) as Promise<bigint>,
      contract.getUtilization({ blockTag }) as Promise<bigint>,
      contract.trackingIndexScale({ blockTag }) as Promise<bigint>,
      contract.baseTrackingSupplySpeed({ blockTag }) as Promise<bigint>,
      contract.baseTrackingBorrowSpeed({ blockTag }) as Promise<bigint>,
    ]);

    const [supplyRatePerSec, borrowRatePerSec] = await Promise.all([
      contract.getSupplyRate(utilization, { blockTag }) as Promise<bigint>,
      contract.getBorrowRate(utilization, { blockTag }) as Promise<bigint>,
    ]);

    const trackingIndexDecimals = scaleToDecimals(trackingIndexScale);
    const supplyApr = Number(
      ethers.formatUnits(supplyRatePerSec * BigInt(YEAR_IN_SECONDS) * 100n, MARKET_DECIMALS),
    );
    const borrowApr = Number(
      ethers.formatUnits(borrowRatePerSec * BigInt(YEAR_IN_SECONDS) * 100n, MARKET_DECIMALS),
    );

    const totalSupplyTokens = Number(ethers.formatUnits(totalSupply, decimals));
    const totalBorrowTokens = Number(ethers.formatUnits(totalBorrow, decimals));

    return {
      incomes: {
        supply: dailyIncomeTokens(totalSupplyTokens, supplyApr),
        borrow: dailyIncomeTokens(totalBorrowTokens, borrowApr),
      },
      spends: {
        supplyUsd: dailySpendUsd(baseTrackingSupplySpeed, trackingIndexDecimals, priceComp),
        borrowUsd: dailySpendUsd(baseTrackingBorrowSpeed, trackingIndexDecimals, priceComp),
      },
    };
  }

  public async marketV2Stats(
    contract: ethers.Contract,
    blockTag: number,
    blocksPerDay: number,
    decimals: number,
  ): Promise<ResponseStatsAlgorithm> {
    const [totalSupply, exchangeRate, totalBorrow, supplyRatePerBlock, borrowRatePerBlock] =
      await Promise.all([
        contract.totalSupply({ blockTag }) as Promise<bigint>,
        contract.exchangeRateStored({ blockTag }) as Promise<bigint>,
        contract.totalBorrows({ blockTag }) as Promise<bigint>,
        contract.supplyRatePerBlock({ blockTag }) as Promise<bigint>,
        contract.borrowRatePerBlock({ blockTag }) as Promise<bigint>,
      ]);

    const blocksPerYear = BigInt(blocksPerDay) * BigInt(YEAR_IN_DAYS);
    const supplyApr = Number(
      ethers.formatUnits(supplyRatePerBlock * blocksPerYear * 100n, MARKET_DECIMALS),
    );
    const borrowApr = Number(
      ethers.formatUnits(borrowRatePerBlock * blocksPerYear * 100n, MARKET_DECIMALS),
    );
    const totalBorrowsTokens = Number(ethers.formatUnits(totalBorrow, decimals));
    const totalSupplyCTokens = Number(ethers.formatUnits(totalSupply, decimals));
    const exchangeRateConvertor = ethers.formatUnits(exchangeRate, MARKET_DECIMALS);
    const totalSupplyTokens = Number(totalSupplyCTokens) * Number(exchangeRateConvertor);

    return {
      incomes: {
        supply: dailyIncomeTokens(totalSupplyTokens, supplyApr),
        borrow: dailyIncomeTokens(totalBorrowsTokens, borrowApr),
      },
    };
  }
}
