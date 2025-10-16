import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { OffsetDto } from 'modules/history/dto/offset.dto';

import { Price } from './price.entity';

import { OffsetDataDto } from '@/common/dto/offset-data.dto';

@Injectable()
export class PriceRepository {
  constructor(@InjectRepository(Price) private readonly priceRepository: Repository<Price>) {}

  async save(price: Price): Promise<Price> {
    return this.priceRepository.save(price);
  }

  async saveToDatabase(price: Price): Promise<Price> {
    // Use insert with orIgnore for consistency with saveBatch
    await this.priceRepository
      .createQueryBuilder()
      .insert()
      .into(Price)
      .values(price)
      .orIgnore() // Ignore duplicates if they exist
      .execute();

    return price;
  }

  async saveBatch(prices: Price[]): Promise<Price[]> {
    if (prices.length === 0) return [];

    // Use bulk insert for better performance
    await this.priceRepository
      .createQueryBuilder()
      .insert()
      .into(Price)
      .values(prices)
      .orIgnore() // Ignore duplicates if they exist
      .execute();

    return prices;
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

  async findBySymbolAndDate(symbol: string, date: Date): Promise<Price | null> {
    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setUTCHours(23, 59, 59, 999);

    return this.priceRepository.findOne({
      where: {
        symbol,
        date: startOfDay, // Assuming dates are stored normalized to start of day
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

  async findEarliestBySymbol(symbol: string): Promise<Price | null> {
    return this.priceRepository.findOne({
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
  ): Promise<Price | null> {
    const startDate = new Date(targetDate);
    startDate.setDate(startDate.getDate() - maxDaysDifference);

    const endDate = new Date(targetDate);
    endDate.setDate(endDate.getDate() + maxDaysDifference);

    const prices = await this.priceRepository
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

  async getOffsetForSymbol(dto: OffsetDto, symbol: string): Promise<OffsetDataDto<Price>> {
    const query = this.priceRepository
      .createQueryBuilder('price')
      .where('price.symbol = :symbol', { symbol })
      .orderBy('price.date', 'ASC');

    if (dto.limit) {
      query.orderBy('price.date', dto.order).offset(dto.offset ?? 0);
    }

    if (dto.limit) query.limit(dto.limit);

    const [prices, total] = await query.getManyAndCount();

    return new OffsetDataDto<Price>(prices, dto.limit ?? null, dto.offset ?? 0, total);
  }
}
