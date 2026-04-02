import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { Price } from './price.entity';

@Injectable()
export class PriceRepository {
  constructor(@InjectRepository(Price) private readonly priceRepository: Repository<Price>) {}

  private getRepository(manager?: EntityManager): Repository<Price> {
    return manager ? manager.getRepository(Price) : this.priceRepository;
  }

  async save(price: Price, manager?: EntityManager): Promise<Price> {
    return this.getRepository(manager).save(price);
  }

  async saveToDatabase(price: Price, manager?: EntityManager): Promise<Price> {
    const existingPrice = await this.findBySymbolAndDate(price.symbol, price.date, manager);
    if (existingPrice) {
      return existingPrice;
    }

    await this.getRepository(manager)
      .createQueryBuilder()
      .insert()
      .into(Price)
      .values(price)
      .execute();

    return price;
  }

  async saveBatch(prices: Price[], manager?: EntityManager): Promise<Price[]> {
    if (prices.length === 0) {
      return [];
    }

    const uniquePrices = this.deduplicatePrices(prices);
    const existingDateKeysBySymbol = await this.findExistingDateKeysBySymbol(uniquePrices, manager);
    const pricesToInsert = uniquePrices.filter((price) => {
      const symbolDateKeys = existingDateKeysBySymbol.get(price.symbol);
      const dateKey = price.date.toISOString().slice(0, 10);

      return !symbolDateKeys?.has(dateKey);
    });

    if (pricesToInsert.length === 0) {
      return [];
    }

    await this.getRepository(manager)
      .createQueryBuilder()
      .insert()
      .into(Price)
      .values(pricesToInsert)
      .execute();

    return pricesToInsert;
  }

  async findById(id: number): Promise<Price> {
    return this.priceRepository.findOne({
      where: { id },
    });
  }

  async findBySymbol(symbol: string): Promise<Price[]> {
    return this.priceRepository.find({
      where: { symbol },
      order: { date: 'DESC' },
    });
  }

  async findBySymbolAndDate(
    symbol: string,
    date: Date,
    manager?: EntityManager,
  ): Promise<Price | null> {
    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);

    return this.getRepository(manager).findOne({
      where: {
        symbol,
        date: startOfDay,
      },
    });
  }

  async findBySymbolInDateRange(symbol: string, startDate: Date, endDate: Date): Promise<Price[]> {
    return this.priceRepository
      .createQueryBuilder('price')
      .where('price.symbol = :symbol', { symbol })
      .andWhere('price.date >= :startDate', { startDate })
      .andWhere('price.date <= :endDate', { endDate })
      .orderBy('price.date', 'ASC')
      .getMany();
  }

  async findDateKeysBySymbolInDateRange(
    symbol: string,
    startDate: Date,
    endDate: Date,
    manager?: EntityManager,
  ): Promise<string[]> {
    const rows = await this.getRepository(manager)
      .createQueryBuilder('price')
      .select('price.date', 'date')
      .where('price.symbol = :symbol', { symbol })
      .andWhere('price.date >= :startDate', { startDate })
      .andWhere('price.date <= :endDate', { endDate })
      .orderBy('price.date', 'ASC')
      .getRawMany<{ date: Date | string }>();

    return rows.map((row) => new Date(row.date).toISOString().slice(0, 10));
  }

  async findEarliestBySymbol(symbol: string, manager?: EntityManager): Promise<Price | null> {
    return this.getRepository(manager).findOne({
      where: { symbol },
      order: { date: 'ASC' },
    });
  }

  async findLatestBySymbol(symbol: string): Promise<Price | null> {
    return this.priceRepository.findOne({
      where: { symbol },
      order: { date: 'DESC' },
    });
  }

  async findNearestBySymbolAndDate(
    symbol: string,
    targetDate: Date,
    maxDaysDifference: number = 30,
    manager?: EntityManager,
  ): Promise<Price | null> {
    const startDate = new Date(targetDate);
    startDate.setDate(startDate.getDate() - maxDaysDifference);

    const endDate = new Date(targetDate);
    endDate.setDate(endDate.getDate() + maxDaysDifference);

    const prices = await this.getRepository(manager)
      .createQueryBuilder('price')
      .where('price.symbol = :symbol', { symbol })
      .andWhere('price.date >= :startDate', { startDate })
      .andWhere('price.date <= :endDate', { endDate })
      .orderBy('ABS(EXTRACT(epoch FROM (price.date - :targetDate)))', 'ASC')
      .setParameter('targetDate', targetDate)
      .limit(1)
      .getMany();

    return prices.length > 0 ? prices[0] : null;
  }

  async countBySymbol(symbol: string): Promise<number> {
    return this.priceRepository.count({
      where: { symbol },
    });
  }

  async deleteBySymbol(symbol: string): Promise<void> {
    await this.priceRepository.delete({ symbol });
  }

  async getAvailableSymbols(): Promise<string[]> {
    const result = await this.priceRepository
      .createQueryBuilder('price')
      .select('DISTINCT price.symbol', 'symbol')
      .getRawMany();

    return result.map((row) => row.symbol);
  }

  async getDateRangeForSymbol(symbol: string): Promise<{ earliest: Date; latest: Date } | null> {
    const result = await this.priceRepository
      .createQueryBuilder('price')
      .select('MIN(price.date)', 'earliest')
      .addSelect('MAX(price.date)', 'latest')
      .where('price.symbol = :symbol', { symbol })
      .getRawOne();

    if (!result.earliest || !result.latest) {
      return null;
    }

    return {
      earliest: new Date(result.earliest),
      latest: new Date(result.latest),
    };
  }

  private deduplicatePrices(prices: Price[]): Price[] {
    const uniquePrices = new Map<string, Price>();

    for (const price of prices) {
      const dateKey = price.date.toISOString().slice(0, 10);
      uniquePrices.set(`${price.symbol}:${dateKey}`, price);
    }

    return Array.from(uniquePrices.values());
  }

  private async findExistingDateKeysBySymbol(
    prices: Price[],
    manager?: EntityManager,
  ): Promise<Map<string, Set<string>>> {
    const priceRanges = new Map<string, { startDate: Date; endDate: Date }>();

    for (const price of prices) {
      const existingRange = priceRanges.get(price.symbol);
      if (!existingRange) {
        priceRanges.set(price.symbol, {
          startDate: new Date(price.date),
          endDate: new Date(price.date),
        });
        continue;
      }

      if (price.date < existingRange.startDate) {
        existingRange.startDate = new Date(price.date);
      }
      if (price.date > existingRange.endDate) {
        existingRange.endDate = new Date(price.date);
      }
    }

    const existingEntries = await Promise.all(
      Array.from(priceRanges.entries()).map(async ([symbol, range]) => {
        const dateKeys = await this.findDateKeysBySymbolInDateRange(
          symbol,
          range.startDate,
          range.endDate,
          manager,
        );

        return [symbol, new Set(dateKeys)] as const;
      }),
    );

    return new Map(existingEntries);
  }
}
