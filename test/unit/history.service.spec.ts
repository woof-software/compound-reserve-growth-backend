import { Test, TestingModule } from '@nestjs/testing';

import { HistoryService } from '../../src/modules/history/history.service';

// Repositories used by HistoryService
class ReservesRepositoryMock {}
class IncomesRepositoryMock {
  getOffsetStats = jest.fn();
}
class SpendsRepositoryMock {
  getOffsetStats = jest.fn();
}
class SourceRepositoryMock {}

describe('HistoryService.getOffsetStatsHistory', () => {
  let service: HistoryService;
  let incomesRepo: IncomesRepositoryMock;
  let spendsRepo: SpendsRepositoryMock;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HistoryService,
        { provide: (require('../../src/modules/history/reserves-repository.service').ReservesRepository), useClass: ReservesRepositoryMock },
        { provide: (require('../../src/modules/history/incomes-repository.service').IncomesRepository), useClass: IncomesRepositoryMock },
        { provide: (require('../../src/modules/history/spends-repository.service').SpendsRepository), useClass: SpendsRepositoryMock },
        { provide: (require('../../src/modules/source/source.repository').SourceRepository), useClass: SourceRepositoryMock },
      ],
    }).compile();

    service = module.get(HistoryService);
    incomesRepo = module.get(require('../../src/modules/history/incomes-repository.service').IncomesRepository);
    spendsRepo = module.get(require('../../src/modules/history/spends-repository.service').SpendsRepository);
  });

  it('merges incomes and spends by date and source id, sorts by date', async () => {
    const date1 = new Date('2024-01-01T00:00:00Z');
    const date2 = new Date('2024-01-02T00:00:00Z');

    (incomesRepo.getOffsetStats as any).mockResolvedValue({
      data: [
        { id: 11, valueSupply: 100, valueBorrow: 10, date: date2, source: { id: 2 } },
        { id: 10, valueSupply: 50, valueBorrow: 5, date: date1, source: { id: 1 } },
      ],
      total: 2,
    });
    (spendsRepo.getOffsetStats as any).mockResolvedValue({
      data: [
        { id: 21, valueSupply: 40, valueBorrow: 4, date: date1, source: { id: 1 } },
        { id: 22, valueSupply: 80, valueBorrow: 8, date: date2, source: { id: 2 } },
      ],
      total: 2,
    });

    const res = await service.getOffsetStatsHistory({ offset: 0, limit: null } as any);

    expect(res.data.length).toBe(2);
    // Sorted by date asc
    expect(res.data[0].incomes.id).toBe(10);
    expect(res.data[0].spends.id).toBe(21);
    expect(res.data[0].sourceId).toBe(1);
    expect(res.data[1].incomes.id).toBe(11);
    expect(res.data[1].spends.id).toBe(22);
    expect(res.total).toBe(2);
  });

  it('handles missing pair (income-only or spend-only) entries', async () => {
    const date1 = new Date('2024-01-01T00:00:00Z');
    const date2 = new Date('2024-01-02T00:00:00Z');

    (incomesRepo.getOffsetStats as any).mockResolvedValue({
      data: [
        { id: 10, valueSupply: 50, valueBorrow: 5, date: date1, source: { id: 1 } },
      ],
      total: 1,
    });
    (spendsRepo.getOffsetStats as any).mockResolvedValue({
      data: [
        { id: 22, valueSupply: 80, valueBorrow: 8, date: date2, source: { id: 2 } },
      ],
      total: 1,
    });

    const res = await service.getOffsetStatsHistory({ offset: 0, limit: null } as any);

    expect(res.data.length).toBe(2);
    const first = res.data.find((x) => x.sourceId === 1)!;
    expect(first.incomes.id).toBe(10);
    expect(first.spends.id).toBe(0);
    const second = res.data.find((x) => x.sourceId === 2)!;
    expect(second.spends.id).toBe(22);
    expect(second.incomes.id).toBe(0);
    // total is min of totals
    expect(res.total).toBe(1);
  });

  it('applies offset and limit when provided', async () => {
    const date1 = new Date('2024-01-01T00:00:00Z');
    const date2 = new Date('2024-01-02T00:00:00Z');
    const date3 = new Date('2024-01-03T00:00:00Z');

    (incomesRepo.getOffsetStats as any).mockResolvedValue({
      data: [
        { id: 10, valueSupply: 1, valueBorrow: 1, date: date1, source: { id: 1 } },
        { id: 11, valueSupply: 2, valueBorrow: 2, date: date2, source: { id: 1 } },
        { id: 12, valueSupply: 3, valueBorrow: 3, date: date3, source: { id: 1 } },
      ],
      total: 3,
    });
    (spendsRepo.getOffsetStats as any).mockResolvedValue({
      data: [
        { id: 20, valueSupply: 1, valueBorrow: 1, date: date1, source: { id: 1 } },
        { id: 21, valueSupply: 2, valueBorrow: 2, date: date2, source: { id: 1 } },
        { id: 22, valueSupply: 3, valueBorrow: 3, date: date3, source: { id: 1 } },
      ],
      total: 3,
    });

    const res = await service.getOffsetStatsHistory({ offset: 1, limit: 1 } as any);

    expect(res.data.length).toBe(1);
    expect(res.data[0].incomes.id).toBe(11);
    expect(res.data[0].spends.id).toBe(21);
    expect(res.offset).toBe(1);
    expect(res.limit).toBe(1);
    expect(res.total).toBe(3);
  });
});


