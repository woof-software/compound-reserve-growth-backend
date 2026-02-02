import { Injectable } from '@nestjs/common';
import { ethers } from 'ethers';

import { ResponseStatsAlgorithm } from 'modules/contract/interface';

import { dailyIncomeTokens, dailySpendUsd } from './math';

import { MARKET_DECIMALS, USD_SCALE, YEAR_IN_DAYS, YEAR_IN_SECONDS } from '@/common/constants';
import { scaleToDecimals } from '@/common/utils/scale-to-decimals';

@Injectable()
export class AlgorithmService {
  constructor() {}

  public async comet(
    contract: ethers.Contract,
    blockTag: number,
    basePriceUsd?: number,
  ): Promise<bigint> {
    const [baseReservesRawResult, baseScaleRawResult, numAssetsRawResult] = await Promise.all([
      contract.getReserves({ blockTag }),
      contract.baseScale({ blockTag }),
      contract.numAssets({ blockTag }),
    ]);

    const baseReservesRaw = BigInt(baseReservesRawResult);
    const baseScale = BigInt(baseScaleRawResult);

    let basePrice: bigint;
    if (typeof basePriceUsd === 'number' && Number.isFinite(basePriceUsd) && basePriceUsd > 0) {
      basePrice = BigInt(Math.round(basePriceUsd * USD_SCALE));
    } else {
      const baseTokenPriceFeed = await contract.baseTokenPriceFeed({ blockTag });
      basePrice = BigInt(await contract.getPrice(baseTokenPriceFeed, { blockTag }));
    }

    if (basePrice === 0n) {
      throw new Error('Base price is zero');
    }

    let totalReserves = baseReservesRaw;
    const assetsCount = Number(numAssetsRawResult);

    if (assetsCount === 0) {
      return totalReserves;
    }

    const assetIndices = Array.from({ length: assetsCount }, (_, index) => index);
    const assetInfos = await Promise.all(
      assetIndices.map((index) => contract.getAssetInfo(index, { blockTag })),
    );

    const collateralReserves = await Promise.all(
      assetInfos.map((assetInfo) => contract.getCollateralReserves(assetInfo.asset, { blockTag })),
    );

    const pricedAssets = assetInfos
      .map((assetInfo, index) => ({
        assetInfo,
        collateralRaw: BigInt(collateralReserves[index]),
      }))
      .filter((entry) => entry.collateralRaw > 0n);

    if (pricedAssets.length === 0) {
      return totalReserves;
    }

    const collateralPrices = await Promise.all(
      pricedAssets.map((entry) => contract.getPrice(entry.assetInfo.priceFeed, { blockTag })),
    );

    for (let index = 0; index < pricedAssets.length; index += 1) {
      const { assetInfo, collateralRaw } = pricedAssets[index];
      const collateralPrice = BigInt(collateralPrices[index]);
      const collateralScale = BigInt(assetInfo.scale);

      if (collateralPrice === 0n) {
        throw new Error(`Collateral price is zero for asset ${assetInfo.asset}`);
      }
      if (collateralScale === 0n) {
        throw new Error(`Collateral scale is zero for asset ${assetInfo.asset}`);
      }

      // Convert collateral reserves to base token units using USD prices.
      const collateralInBaseUnits =
        (collateralRaw * collateralPrice * baseScale) / (collateralScale * basePrice);

      totalReserves += collateralInBaseUnits;
    }

    return totalReserves;
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
    const totalBorrow: bigint = await contract.totalBorrow({ blockTag });
    const utilization: bigint = await contract.getUtilization({ blockTag });
    const supplyRatePerSec: bigint = await contract.getSupplyRate(utilization, { blockTag });
    const borrowRatePerSec: bigint = await contract.getBorrowRate(utilization, { blockTag });
    const trackingIndexScale: bigint = await contract.trackingIndexScale({ blockTag });
    const trackingIndexDecimals = scaleToDecimals(trackingIndexScale);
    const supplyApr = Number(
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
    const totalSupply: bigint = await contract.totalSupply({ blockTag });
    const exchangeRate: bigint = await contract.exchangeRateStored({ blockTag });
    const totalBorrow: bigint = await contract.totalBorrows({ blockTag });
    const supplyRatePerBlock: bigint = await contract.supplyRatePerBlock({ blockTag });
    const borrowRatePerBlock: bigint = await contract.borrowRatePerBlock({ blockTag });
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
