import { ethers } from 'ethers';

import { IncentiveCompPrice } from '@/modules/incentives/types/incentive-comp-price.type';
import { IncentiveProjectionRow } from '@/modules/incentives/types/incentive-projection-row.type';
import { IncentiveReserveSnapshot } from '@/modules/incentives/types/incentive-reserve-snapshot.type';
import { IncentiveSpendSnapshot } from '@/modules/incentives/types/incentive-spend-snapshot.type';

const buildProjectionKey = (sourceId: number, day: string): string => `${sourceId}:${day}`;

const compareProjectionRows = (
  left: IncentiveProjectionRow,
  right: IncentiveProjectionRow,
): number => {
  return (
    left.date.getTime() - right.date.getTime() ||
    left.sourceId - right.sourceId ||
    (left.reserveId ?? Number.MAX_SAFE_INTEGER) - (right.reserveId ?? Number.MAX_SAFE_INTEGER) ||
    (left.spendId ?? Number.MAX_SAFE_INTEGER) - (right.spendId ?? Number.MAX_SAFE_INTEGER)
  );
};

const compareReserveSnapshots = (
  left: IncentiveReserveSnapshot,
  right: IncentiveReserveSnapshot,
): number => {
  return (
    left.date.getTime() - right.date.getTime() ||
    left.sourceId - right.sourceId ||
    left.reserveId - right.reserveId
  );
};

const compareSpendSnapshots = (
  left: IncentiveSpendSnapshot,
  right: IncentiveSpendSnapshot,
): number => {
  return (
    left.date.getTime() - right.date.getTime() ||
    left.sourceId - right.sourceId ||
    left.spendId - right.spendId
  );
};

const resolvePriceComp = (
  spendSnapshot: IncentiveSpendSnapshot | undefined,
  compPriceByDay: Map<string, number>,
  day: string,
): number => {
  if (spendSnapshot && spendSnapshot.priceComp > 0) {
    return spendSnapshot.priceComp;
  }

  return compPriceByDay.get(day) ?? 0;
};

export const buildIncentiveProjectionRows = (
  reserveSnapshots: IncentiveReserveSnapshot[],
  spendSnapshots: IncentiveSpendSnapshot[],
  compPrices: IncentiveCompPrice[],
): IncentiveProjectionRow[] => {
  const rows: IncentiveProjectionRow[] = [];
  const compPriceByDay = new Map(compPrices.map((row) => [row.day, row.priceComp]));
  const spendByKey = new Map(
    spendSnapshots.map((snapshot) => [
      buildProjectionKey(snapshot.sourceId, snapshot.day),
      snapshot,
    ]),
  );
  const reserveKeys = new Set<string>();
  const previousQuantityBySource = new Map<number, bigint>();

  for (const snapshot of [...reserveSnapshots].sort(compareReserveSnapshots)) {
    const key = buildProjectionKey(snapshot.sourceId, snapshot.day);
    const spendSnapshot = spendByKey.get(key);
    const quantity = BigInt(snapshot.quantity);
    const previousQuantity = previousQuantityBySource.get(snapshot.sourceId);

    previousQuantityBySource.set(snapshot.sourceId, quantity);
    reserveKeys.add(key);

    rows.push({
      reserveId: snapshot.reserveId,
      spendId: spendSnapshot?.spendId ?? null,
      sourceId: snapshot.sourceId,
      date: snapshot.date,
      incomes:
        previousQuantity === undefined
          ? snapshot.value
          : Number(ethers.formatUnits(quantity - previousQuantity, snapshot.decimals)) *
            snapshot.price,
      rewardsSupply: spendSnapshot?.valueSupply ?? 0,
      rewardsBorrow: spendSnapshot?.valueBorrow ?? 0,
      priceComp: resolvePriceComp(spendSnapshot, compPriceByDay, snapshot.day),
    });
  }

  for (const snapshot of [...spendSnapshots].sort(compareSpendSnapshots)) {
    const key = buildProjectionKey(snapshot.sourceId, snapshot.day);

    if (reserveKeys.has(key)) {
      continue;
    }

    rows.push({
      reserveId: null,
      spendId: snapshot.spendId,
      sourceId: snapshot.sourceId,
      date: snapshot.date,
      incomes: 0,
      rewardsSupply: snapshot.valueSupply,
      rewardsBorrow: snapshot.valueBorrow,
      priceComp: resolvePriceComp(snapshot, compPriceByDay, snapshot.day),
    });
  }

  return rows.sort(compareProjectionRows);
};

export const normalizeIncentivePriceComp = (
  rows: IncentiveProjectionRow[],
): IncentiveProjectionRow[] => {
  const missingLeadingIndexes: number[] = [];
  let firstPrice = 0;
  let previousPrice = 0;

  const normalizedRows = rows.map((row, index) => {
    const normalizedRow = { ...row };

    if (!normalizedRow.priceComp) {
      if (previousPrice) {
        normalizedRow.priceComp = previousPrice;
      } else {
        missingLeadingIndexes.push(index);
      }
    } else {
      firstPrice = firstPrice || normalizedRow.priceComp;
      previousPrice = normalizedRow.priceComp;
    }

    return normalizedRow;
  });

  if (firstPrice) {
    missingLeadingIndexes.forEach((index) => {
      normalizedRows[index].priceComp = firstPrice;
    });
  }

  return normalizedRows;
};
