import { Reserve } from '@/modules/history/entities';
import { SourceEntity } from '@/modules/source/source.entity';
import { HistoryService } from '@/modules/history/history.service';

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
    const reservesRepo = {
      findLatestBySourceId,
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

    return { service, findLatestBySourceId };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findLatestReserveBySource', () => {
    it('returns latest reserve when one exists for the source', async () => {
      const { service, findLatestBySourceId } = makeDeps();
      const source = makeSource(10);
      const mockReserve = {
        id: 1,
        blockNumber: 50_000,
        sourceId: 10,
        source,
      } as unknown as Reserve;
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
});
