import { ReserveEntity } from '@/modules/history/entities';
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
});
