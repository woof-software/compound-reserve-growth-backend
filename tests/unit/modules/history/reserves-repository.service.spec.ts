import { Reserve } from '@/modules/history/entities';
import { ReservesRepository } from '@/modules/history/reserves-repository.service';

describe('ReservesRepository', () => {
  const makeReservesRepository = () => {
    const findOne = jest.fn();
    const reservesRepository = {
      findOne,
      find: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(),
      clear: jest.fn(),
    };
    const spendsRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    const priceRepository = { find: jest.fn() };
    const dataSource = { createQueryRunner: jest.fn() };

    const repo = new ReservesRepository(
      reservesRepository as never,
      spendsRepository as never,
      priceRepository as never,
      dataSource as never,
    );

    return { repo, findOne, reservesRepository };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findLatestBySourceId', () => {
    it('queries reserve by source id ordered by blockNumber descending', async () => {
      const { repo, findOne } = makeReservesRepository();
      const sourceId = 42;
      const mockReserve = { id: 1, blockNumber: 100_000, sourceId } as unknown as Reserve;
      findOne.mockResolvedValue(mockReserve);

      const result = await repo.findLatestBySourceId(sourceId);

      expect(result).toBe(mockReserve);
      expect(findOne).toHaveBeenCalledTimes(1);
      expect(findOne).toHaveBeenCalledWith({
        where: { source: { id: sourceId } },
        relations: { source: true },
        order: { blockNumber: 'DESC' },
      });
    });

    it('returns null when no reserve exists for the source', async () => {
      const { repo, findOne } = makeReservesRepository();
      findOne.mockResolvedValue(null);

      const result = await repo.findLatestBySourceId(99);

      expect(result).toBeNull();
      expect(findOne).toHaveBeenCalledWith({
        where: { source: { id: 99 } },
        relations: { source: true },
        order: { blockNumber: 'DESC' },
      });
    });
  });
});
