import { DataSource } from 'typeorm';

import { OffsetDto } from '@/common/dto/offset.dto';
import {
  buildIncentiveProjectionRows,
  normalizeIncentivePriceComp,
} from '@/modules/incentives/builders/build-incentive-projection-rows';
import { IncentivesSyncRepository } from '@/modules/incentives/incentives-sync.repository';
import { IncentivesRepository } from '@/modules/incentives/incentives.repository';
import { Order } from '@/common/enum/order.enum';

describe('IncentivesRepository', () => {
  const makeQueryRepository = () => {
    const getManyAndCount = jest.fn();
    const queryBuilder = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getManyAndCount,
    };
    const typeormRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    const dataSource = {
      createQueryRunner: jest.fn(),
    } as unknown as DataSource;

    return {
      repo: new IncentivesRepository(typeormRepository as never),
      typeormRepository,
      queryBuilder,
      getManyAndCount,
      dataSource,
    };
  };

  const makeSyncRepository = () => {
    const dataSource = {
      createQueryRunner: jest.fn(),
    } as unknown as DataSource;

    return {
      repo: new IncentivesSyncRepository(dataSource),
      dataSource,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns offset history with deterministic ordering and pagination metadata', async () => {
    const { repo, typeormRepository, queryBuilder, getManyAndCount } = makeQueryRepository();
    const items = [
      {
        id: 1,
        source: { id: 3 },
        date: new Date('2026-01-03T00:00:00.000Z'),
      },
    ];
    getManyAndCount.mockResolvedValue([items, 5]);

    const result = await repo.getOffsetHistory(new OffsetDto(2, 10, Order.ASC));

    expect(typeormRepository.createQueryBuilder).toHaveBeenCalledWith('incentive');
    expect(queryBuilder.orderBy).toHaveBeenCalledWith('incentive.date', Order.ASC);
    expect(queryBuilder.addOrderBy).toHaveBeenNthCalledWith(1, 'source.id', 'ASC');
    expect(queryBuilder.addOrderBy).toHaveBeenNthCalledWith(2, 'incentive.id', 'ASC');
    expect(queryBuilder.offset).toHaveBeenCalledWith(10);
    expect(queryBuilder.limit).toHaveBeenCalledWith(2);
    expect(result.data).toBe(items);
    expect(result.limit).toBe(2);
    expect(result.offset).toBe(10);
    expect(result.total).toBe(5);
  });

  it('maps raw reserve snapshots into normalized numeric values', async () => {
    const { repo } = makeSyncRepository();
    const manager = {
      query: jest.fn().mockResolvedValue([
        {
          reserveId: '1',
          sourceId: '3',
          date: '2026-01-03T00:00:00.000Z',
          day: '2026-01-03',
          price: '11',
          value: '10.5',
          quantity: '1000000000000000000',
          decimals: '18',
        },
        {
          reserveId: '9',
          sourceId: '4',
          date: new Date('2026-01-04T00:00:00.000Z'),
          day: '2026-01-04',
          price: '4',
          value: '2',
          quantity: '2000000',
          decimals: '6',
        },
      ]),
    };

    const result = await repo.listDailyReserveSnapshots([3, 4], manager as never);

    expect(manager.query).toHaveBeenCalledWith(expect.any(String), [[3, 4]]);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      reserveId: 1,
      sourceId: 3,
      day: '2026-01-03',
      price: 11,
      value: 10.5,
      quantity: '1000000000000000000',
      decimals: 18,
    });
    expect(result[0].date.toISOString()).toBe('2026-01-03T00:00:00.000Z');
    expect(result[1]).toMatchObject({
      reserveId: 9,
      sourceId: 4,
      day: '2026-01-04',
      price: 4,
      value: 2,
      quantity: '2000000',
      decimals: 6,
    });
    expect(result[1].date.toISOString()).toBe('2026-01-04T00:00:00.000Z');
  });

  it('maps raw spend snapshots and defaults nullable numeric values to zero', async () => {
    const { repo } = makeSyncRepository();
    const manager = {
      query: jest.fn().mockResolvedValue([
        {
          spendId: '5',
          sourceId: '8',
          date: '2026-03-04T00:00:00.000Z',
          day: '2026-03-04',
          valueSupply: null,
          valueBorrow: null,
          priceComp: null,
        },
        {
          spendId: '6',
          sourceId: '9',
          date: new Date('2026-03-05T00:00:00.000Z'),
          day: '2026-03-05',
          valueSupply: '1.5',
          valueBorrow: '2.5',
          priceComp: '3.5',
        },
      ]),
    };

    const result = await repo.listLatestSpends([8, 9], manager as never);

    expect(manager.query).toHaveBeenCalledWith(expect.any(String), [[8, 9]]);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      spendId: 5,
      sourceId: 8,
      day: '2026-03-04',
      valueSupply: 0,
      valueBorrow: 0,
      priceComp: 0,
    });
    expect(result[0].date.toISOString()).toBe('2026-03-04T00:00:00.000Z');
    expect(result[1]).toMatchObject({
      spendId: 6,
      sourceId: 9,
      day: '2026-03-05',
      valueSupply: 1.5,
      valueBorrow: 2.5,
      priceComp: 3.5,
    });
  });

  it('builds and normalizes incentive projection rows from reserve and spend snapshots', () => {
    const rows = buildIncentiveProjectionRows(
      [
        {
          reserveId: 1,
          sourceId: 3,
          date: new Date('2026-01-03T00:00:00.000Z'),
          day: '2026-01-03',
          price: 10,
          value: 10,
          quantity: '1000000000000000000',
          decimals: 18,
        },
        {
          reserveId: 2,
          sourceId: 3,
          date: new Date('2026-01-04T00:00:00.000Z'),
          day: '2026-01-04',
          price: 12,
          value: 24,
          quantity: '3000000000000000000',
          decimals: 18,
        },
      ],
      [
        {
          spendId: 9,
          sourceId: 3,
          date: new Date('2026-01-04T00:00:00.000Z'),
          day: '2026-01-04',
          valueSupply: 2,
          valueBorrow: 3,
          priceComp: 0,
        },
        {
          spendId: 10,
          sourceId: 4,
          date: new Date('2026-01-05T00:00:00.000Z'),
          day: '2026-01-05',
          valueSupply: 4,
          valueBorrow: 5,
          priceComp: 6,
        },
      ],
      [
        { day: '2026-01-03', priceComp: 7 },
        { day: '2026-01-04', priceComp: 8 },
      ],
    );

    const normalized = normalizeIncentivePriceComp(rows);

    expect(normalized).toHaveLength(3);
    expect(normalized[0]).toMatchObject({
      reserveId: 1,
      spendId: null,
      sourceId: 3,
      incomes: 10,
      rewardsSupply: 0,
      rewardsBorrow: 0,
      priceComp: 7,
    });
    expect(normalized[1]).toMatchObject({
      reserveId: 2,
      spendId: 9,
      sourceId: 3,
      incomes: 24,
      rewardsSupply: 2,
      rewardsBorrow: 3,
      priceComp: 8,
    });
    expect(normalized[2]).toMatchObject({
      reserveId: null,
      spendId: 10,
      sourceId: 4,
      incomes: 0,
      rewardsSupply: 4,
      rewardsBorrow: 5,
      priceComp: 6,
    });
  });
});
