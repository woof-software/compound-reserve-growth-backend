import { ReserveEntity } from '@/modules/history/entities';
import { OffsetDto } from '@/modules/history/dto/offset.dto';
import { ReservesRepository } from '@/modules/history/reserves-repository.service';
import { Algorithm } from '@/common/enum/algorithm.enum';
import { Order } from '@/common/enum/order.enum';

describe('ReservesRepository', () => {
  const makeReservesRepository = () => {
    const findOne = jest.fn();
    const reservesRepository = {
      findOne,
      find: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(),
      query: jest.fn(),
      clear: jest.fn(),
    };
    const repo = new ReservesRepository(reservesRepository as never);

    return { repo, findOne, reservesRepository };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findLatestBySourceId', () => {
    it('queries reserve by source id ordered by blockNumber descending', async () => {
      const { repo, reservesRepository } = makeReservesRepository();
      const sourceId = 42;
      const mockReserve = {
        id: 1,
        blockNumber: 100_000,
        source: { id: sourceId },
      } as unknown as ReserveEntity;
      const getOne = jest.fn().mockResolvedValue(mockReserve);
      reservesRepository.createQueryBuilder.mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne,
      });

      const result = await repo.findLatestBySourceId(sourceId);

      expect(result).toBe(mockReserve);
      expect(reservesRepository.createQueryBuilder).toHaveBeenCalledWith('reserves');
      expect(getOne).toHaveBeenCalledTimes(1);
    });

    it('returns null when no reserve exists for the source', async () => {
      const { repo, reservesRepository } = makeReservesRepository();
      const getOne = jest.fn().mockResolvedValue(null);
      reservesRepository.createQueryBuilder.mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne,
      });

      const result = await repo.findLatestBySourceId(99);

      expect(result).toBeNull();
      expect(reservesRepository.createQueryBuilder).toHaveBeenCalledWith('reserves');
      expect(getOne).toHaveBeenCalledTimes(1);
    });
  });

  describe('getOffsetIncentivesHistory', () => {
    const setupIncentivesQueries = (reservesRepository: { query: jest.Mock }, rows: unknown[]) => {
      reservesRepository.query.mockResolvedValue(rows);
    };

    it('returns combined row when reserves and incentives are both present', async () => {
      const { repo, reservesRepository } = makeReservesRepository();
      const day = new Date('2026-01-01T00:00:00.000Z');

      setupIncentivesQueries(reservesRepository, [
        {
          sourceId: '1',
          date: day,
          incomes: '10',
          rewardsSupply: '3',
          rewardsBorrow: '2',
          priceComp: '5',
          total: '1',
        },
      ]);

      const result = await repo.getOffsetIncentivesHistory(new OffsetDto(undefined, 0, Order.ASC), [
        Algorithm.COMET_STATS,
      ]);

      expect(result.total).toBe(1);
      expect(result.data[0]).toMatchObject({
        sourceId: 1,
        incomes: 10,
        rewardsSupply: 3,
        rewardsBorrow: 2,
        priceComp: 5,
      });
    });

    it('returns zero rewards when reserves are present and incentives are absent', async () => {
      const { repo, reservesRepository } = makeReservesRepository();
      const day = new Date('2026-01-02T00:00:00.000Z');

      setupIncentivesQueries(reservesRepository, [
        {
          sourceId: '2',
          date: day,
          incomes: '10',
          rewardsSupply: '0',
          rewardsBorrow: '0',
          priceComp: '40',
          total: '1',
        },
      ]);

      const result = await repo.getOffsetIncentivesHistory(new OffsetDto(undefined, 0, Order.ASC), [
        Algorithm.COMET_STATS,
      ]);

      expect(result.total).toBe(1);
      expect(result.data[0]).toMatchObject({
        sourceId: 2,
        incomes: 10,
        rewardsSupply: 0,
        rewardsBorrow: 0,
        priceComp: 40,
      });
    });

    it('returns zero incomes when incentives are present and reserves are absent', async () => {
      const { repo, reservesRepository } = makeReservesRepository();
      const day = new Date('2026-01-03T00:00:00.000Z');

      setupIncentivesQueries(reservesRepository, [
        {
          sourceId: '3',
          date: day,
          incomes: '0',
          rewardsSupply: '7',
          rewardsBorrow: '1',
          priceComp: '11',
          total: '1',
        },
      ]);

      const result = await repo.getOffsetIncentivesHistory(new OffsetDto(undefined, 0, Order.ASC), [
        Algorithm.COMET_STATS,
      ]);

      expect(result.total).toBe(1);
      expect(result.data[0]).toMatchObject({
        sourceId: 3,
        incomes: 0,
        rewardsSupply: 7,
        rewardsBorrow: 1,
        priceComp: 11,
      });
    });

    it('returns empty data when both reserves and incentives are absent', async () => {
      const { repo, reservesRepository } = makeReservesRepository();

      setupIncentivesQueries(reservesRepository, [
        {
          sourceId: null,
          date: null,
          incomes: null,
          rewardsSupply: null,
          rewardsBorrow: null,
          priceComp: null,
          total: '0',
        },
      ]);

      const result = await repo.getOffsetIncentivesHistory(new OffsetDto(undefined, 0, Order.ASC), [
        Algorithm.COMET_STATS,
      ]);

      expect(result.total).toBe(0);
      expect(result.data).toEqual([]);
    });

    it('maps raw epoch milliseconds string to UTC date', async () => {
      const { repo, reservesRepository } = makeReservesRepository();

      setupIncentivesQueries(reservesRepository, [
        {
          sourceId: '7',
          date: '1772582400000',
          incomes: '1',
          rewardsSupply: '2',
          rewardsBorrow: '3',
          priceComp: '4',
          total: '1',
        },
      ]);

      const result = await repo.getOffsetIncentivesHistory(new OffsetDto(undefined, 0, Order.ASC), [
        Algorithm.COMET_STATS,
      ]);

      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].date.toISOString()).toBe('2026-03-04T00:00:00.000Z');
    });

    it('maps raw epoch milliseconds number to UTC date', async () => {
      const { repo, reservesRepository } = makeReservesRepository();

      setupIncentivesQueries(reservesRepository, [
        {
          sourceId: '8',
          date: 1772582400000,
          incomes: '1',
          rewardsSupply: '2',
          rewardsBorrow: '3',
          priceComp: '4',
          total: '1',
        },
      ]);

      const result = await repo.getOffsetIncentivesHistory(new OffsetDto(undefined, 0, Order.ASC), [
        Algorithm.COMET_STATS,
      ]);

      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].date.toISOString()).toBe('2026-03-04T00:00:00.000Z');
    });

    it('keeps valid pagination across multiple pages', async () => {
      const { repo, reservesRepository } = makeReservesRepository();
      const day1 = new Date('2026-02-01T00:00:00.000Z');
      const day2 = new Date('2026-02-02T00:00:00.000Z');

      reservesRepository.query
        .mockResolvedValueOnce([
          {
            sourceId: '10',
            date: day1,
            incomes: '1',
            rewardsSupply: '2',
            rewardsBorrow: '3',
            priceComp: '4',
            total: '2',
          },
        ])
        .mockResolvedValueOnce([
          {
            sourceId: '11',
            date: day2,
            incomes: '5',
            rewardsSupply: '6',
            rewardsBorrow: '7',
            priceComp: '8',
            total: '2',
          },
        ]);

      const page1 = await repo.getOffsetIncentivesHistory(new OffsetDto(1, 0, Order.ASC), [
        Algorithm.COMET_STATS,
      ]);
      const page2 = await repo.getOffsetIncentivesHistory(new OffsetDto(1, 1, Order.ASC), [
        Algorithm.COMET_STATS,
      ]);

      expect(page1.total).toBe(2);
      expect(page1.limit).toBe(1);
      expect(page1.offset).toBe(0);
      expect(page1.data).toHaveLength(1);
      expect(page1.data[0].sourceId).toBe(10);

      expect(page2.total).toBe(2);
      expect(page2.limit).toBe(1);
      expect(page2.offset).toBe(1);
      expect(page2.data).toHaveLength(1);
      expect(page2.data[0].sourceId).toBe(11);

      expect(reservesRepository.query).toHaveBeenNthCalledWith(1, expect.any(String), [
        '{comet_stats}',
        0,
        1,
      ]);
      expect(reservesRepository.query).toHaveBeenNthCalledWith(2, expect.any(String), [
        '{comet_stats}',
        1,
        1,
      ]);
    });

    it('keeps total when requested page is empty due to high offset', async () => {
      const { repo, reservesRepository } = makeReservesRepository();

      setupIncentivesQueries(reservesRepository, [
        {
          sourceId: null,
          date: null,
          incomes: null,
          rewardsSupply: null,
          rewardsBorrow: null,
          priceComp: null,
          total: '5',
        },
      ]);

      const result = await repo.getOffsetIncentivesHistory(new OffsetDto(2, 10, Order.ASC), [
        Algorithm.COMET_STATS,
      ]);

      expect(result.data).toEqual([]);
      expect(result.total).toBe(5);
      expect(result.limit).toBe(2);
      expect(result.offset).toBe(10);
    });
  });
});
