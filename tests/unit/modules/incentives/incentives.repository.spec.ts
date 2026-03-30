import { DataSource } from 'typeorm';

import { OffsetDto } from '@/modules/history/dto/offset.dto';
import { IncentivesRepository } from '@/modules/incentives/incentives.repository';
import { Order } from '@/common/enum/order.enum';

describe('IncentivesRepository', () => {
  const makeRepository = () => {
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
      repo: new IncentivesRepository(typeormRepository as never, dataSource),
      typeormRepository,
      queryBuilder,
      getManyAndCount,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns offset history with deterministic ordering and pagination metadata', async () => {
    const { repo, typeormRepository, queryBuilder, getManyAndCount } = makeRepository();
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

  it('maps raw projection rows into normalized numeric values', async () => {
    const { repo } = makeRepository();
    const manager = {
      query: jest.fn().mockResolvedValue([
        {
          reserveId: '1',
          spendId: null,
          sourceId: '3',
          date: '2026-01-03T00:00:00.000Z',
          incomes: '10.5',
          rewardsSupply: '7',
          rewardsBorrow: '1',
          priceComp: '11',
        },
        {
          reserveId: null,
          spendId: '9',
          sourceId: '4',
          date: new Date('2026-01-04T00:00:00.000Z'),
          incomes: '0',
          rewardsSupply: '2',
          rewardsBorrow: '3',
          priceComp: '4',
        },
      ]),
    };

    const result = await repo.buildProjectionRows(manager as never);

    expect(manager.query).toHaveBeenCalledWith(expect.any(String), [
      '{comet_stats,market_v2,aera_compound_reserves}',
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      reserveId: 1,
      spendId: null,
      sourceId: 3,
      incomes: 10.5,
      rewardsSupply: 7,
      rewardsBorrow: 1,
      priceComp: 11,
    });
    expect(result[0].date.toISOString()).toBe('2026-01-03T00:00:00.000Z');
    expect(result[1]).toMatchObject({
      reserveId: null,
      spendId: 9,
      sourceId: 4,
      incomes: 0,
      rewardsSupply: 2,
      rewardsBorrow: 3,
      priceComp: 4,
    });
    expect(result[1].date.toISOString()).toBe('2026-01-04T00:00:00.000Z');
  });

  it('filters incomplete raw rows and defaults nullable numeric values to zero', async () => {
    const { repo } = makeRepository();
    const manager = {
      query: jest.fn().mockResolvedValue([
        {
          reserveId: null,
          spendId: null,
          sourceId: null,
          date: null,
          incomes: null,
          rewardsSupply: null,
          rewardsBorrow: null,
          priceComp: null,
        },
        {
          reserveId: null,
          spendId: null,
          sourceId: '8',
          date: '2026-03-04T00:00:00.000Z',
          incomes: null,
          rewardsSupply: null,
          rewardsBorrow: null,
          priceComp: null,
        },
      ]),
    };

    const result = await repo.buildProjectionRows(manager as never);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      reserveId: null,
      spendId: null,
      sourceId: 8,
      incomes: 0,
      rewardsSupply: 0,
      rewardsBorrow: 0,
      priceComp: 0,
    });
    expect(result[0].date.toISOString()).toBe('2026-03-04T00:00:00.000Z');
  });
});
