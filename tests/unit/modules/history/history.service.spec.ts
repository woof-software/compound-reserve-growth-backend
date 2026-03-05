import { ReserveEntity } from '@/modules/history/entities';
import { SourceEntity } from '@/modules/source/source.entity';
import { HistoryService } from '@/modules/history/history.service';
import { OffsetDto } from '@/modules/history/dto/offset.dto';
import { Order } from '@/common/enum/order.enum';

describe('HistoryService', () => {
  const makeSource = (id: number): SourceEntity => {
    const source = new SourceEntity(
      '0x0000000000000000000000000000000000000001',
      'eth',
      ['comet'],
      'treasury',
      1000,
      {} as never,
      undefined,
      null,
    );
    source.id = id;
    return source;
  };

  const makeDeps = () => {
    const findLatestBySourceId = jest.fn();
    const getOffsetIncentivesHistory = jest.fn();
    const reservesRepo = {
      findLatestBySourceId,
      getOffsetIncentivesHistory,
      findById: jest.fn(),
      save: jest.fn(),
      getTreasuryReserves: jest.fn(),
      getPaginatedTreasuryReserves: jest.fn(),
      getOffsetTreasuryReserves: jest.fn(),
      getTreasuryHoldings: jest.fn(),
      deleteBySourceIds: jest.fn(),
    };
    const incomesRepo = { findBySourceId: jest.fn(), save: jest.fn() };
    const spendsRepo = { findBySourceId: jest.fn(), save: jest.fn() };
    const sourceRepo = { findById: jest.fn() };

    const service = new HistoryService(
      reservesRepo as never,
      incomesRepo as never,
      spendsRepo as never,
      sourceRepo as never,
    );

    return { service, findLatestBySourceId, getOffsetIncentivesHistory };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findLatestReserveBySource', () => {
    it('returns latest reserve when one exists for the source', async () => {
      const { service, findLatestBySourceId } = makeDeps();
      const source = makeSource(10);
      const mockReserve = new ReserveEntity(source, 50_000, '0', 0, 0, new Date());
      mockReserve.id = 1;
      findLatestBySourceId.mockResolvedValue(mockReserve);

      const result = await service.findLatestReserveBySource(source);

      expect(result).toBe(mockReserve);
      expect(findLatestBySourceId).toHaveBeenCalledTimes(1);
      expect(findLatestBySourceId).toHaveBeenCalledWith(10);
    });

    it('returns null when no reserves exist for the source', async () => {
      const { service, findLatestBySourceId } = makeDeps();
      const source = makeSource(20);
      findLatestBySourceId.mockResolvedValue(null);

      const result = await service.findLatestReserveBySource(source);

      expect(result).toBeNull();
      expect(findLatestBySourceId).toHaveBeenCalledWith(20);
    });
  });

  describe('getIncentiveHistory', () => {
    it('returns row with zero incomes when repository provides incentives without reserves', async () => {
      const { service, getOffsetIncentivesHistory } = makeDeps();
      const date = new Date('2026-01-03T00:00:00.000Z');
      getOffsetIncentivesHistory.mockResolvedValue({
        data: [
          {
            sourceId: 3,
            date,
            incomes: 0,
            rewardsSupply: 7,
            rewardsBorrow: 1,
            priceComp: 11,
          },
        ],
        limit: null,
        offset: 0,
        total: 1,
      });

      const result = await service.getIncentiveHistory(new OffsetDto(undefined, 0, Order.ASC));

      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        sourceId: 3,
        incomes: 0,
        rewardsSupply: 7,
        rewardsBorrow: 1,
        priceComp: 11,
      });
    });

    it('preserves total when page data is empty due to high offset', async () => {
      const { service, getOffsetIncentivesHistory } = makeDeps();
      getOffsetIncentivesHistory.mockResolvedValue({
        data: [],
        limit: 2,
        offset: 10,
        total: 5,
      });

      const result = await service.getIncentiveHistory(new OffsetDto(2, 10, Order.ASC));

      expect(result.data).toEqual([]);
      expect(result.limit).toBe(2);
      expect(result.offset).toBe(10);
      expect(result.total).toBe(5);
    });
  });
});
