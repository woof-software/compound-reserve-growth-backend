import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index, JoinColumn, ManyToOne } from 'typeorm';
import { Source } from 'modules/source/source.entity';

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

  @Column('decimal', { precision: 78, scale: 8 })
  avgRatio: string;

  @Column('decimal', { precision: 78, scale: 8 })
  minRatio: string;

  @Column('decimal', { precision: 78, scale: 8 })
  maxRatio: string;

  @Column('decimal', { precision: 78, scale: 8 })
  avgPrice: string;

  @Column('decimal', { precision: 78, scale: 8 })
  minPrice: string;

  @Column('decimal', { precision: 78, scale: 0 })
  public maxPrice: string;

  @Column()
  public cappedCount: number;

  @Column()
  public totalCount: number;

  @CreateDateColumn()
  public createdAt: Date;

  @Column({ nullable: true })
  public sourceId: number | null;
  
  @Column({ nullable: true })
  public assetId: number | null;

  @ManyToOne(() => Source, (source) => source.dailyAggregations, { eager: false, nullable: true })
  @JoinColumn({ name: 'sourceId' })
  public source?: Source | null;
}
