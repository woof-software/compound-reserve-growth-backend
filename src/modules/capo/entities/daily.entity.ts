import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity()
@Index(['oracleAddress', 'date'])
export class DailyAggregation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  oracleAddress: string;

  @Column()
  oracleName: string;

  @Column()
  chainId: number;

  @Column('date')
  date: Date;

  @Column('decimal', { precision: 78, scale: 0 })
  avgRatio: string;

  @Column('decimal', { precision: 78, scale: 0 })
  minRatio: string;

  @Column('decimal', { precision: 78, scale: 0 })
  maxRatio: string;

  @Column('decimal', { precision: 78, scale: 0 })
  avgPrice: string;

  @Column('decimal', { precision: 78, scale: 0 })
  minPrice: string;

  @Column('decimal', { precision: 78, scale: 0 })
  maxPrice: string;

  @Column()
  cappedCount: number;

  @Column()
  totalCount: number;

  @CreateDateColumn()
  createdAt: Date;
}
