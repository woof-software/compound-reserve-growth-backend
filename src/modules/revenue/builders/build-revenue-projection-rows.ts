import { ethers } from 'ethers';

import { RevenueProjectionRow } from '@/modules/revenue/types/revenue-projection-row.type';
import { RevenueReserveSnapshot } from '@/modules/revenue/types/revenue-reserve-snapshot.type';

const compareRevenueSnapshots = (
  left: RevenueReserveSnapshot,
  right: RevenueReserveSnapshot,
): number => {
  return (
    left.date.getTime() - right.date.getTime() ||
    left.sourceId - right.sourceId ||
    left.reserveId - right.reserveId
  );
};

export const buildRevenueProjectionRows = (
  reserveSnapshots: RevenueReserveSnapshot[],
): RevenueProjectionRow[] => {
  const orderedSnapshots = [...reserveSnapshots].sort(compareRevenueSnapshots);
  const previousQuantityBySource = new Map<number, bigint>();
  const rows: RevenueProjectionRow[] = [];

  for (const snapshot of orderedSnapshots) {
    const quantity = BigInt(snapshot.quantity);
    const previousQuantity = previousQuantityBySource.get(snapshot.sourceId);
    const quantityDelta = previousQuantity === undefined ? quantity : quantity - previousQuantity;

    previousQuantityBySource.set(snapshot.sourceId, quantity);

    if (snapshot.isLookback) {
      continue;
    }

    rows.push({
      reserveId: snapshot.reserveId,
      sourceId: snapshot.sourceId,
      blockNumber: snapshot.blockNumber,
      quantityDelta: quantityDelta.toString(),
      price: snapshot.price,
      value: Number(ethers.formatUnits(quantityDelta, snapshot.decimals)) * snapshot.price,
      date: snapshot.date,
    });
  }

  return rows;
};
