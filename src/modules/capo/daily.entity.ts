import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index, JoinColumn, ManyToOne } from 'typeorm';
import { Source } from 'modules/source/source.entity';

@Entity()
@Index(['oracleAddress', 'date'])
export class DailyAggregation {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column()
  public oracleAddress: string;

  @Column()
  public oracleName: string;

  @Column()
  public chainId: number;

  @Column('date')
  public date: Date;

  @Column('decimal', { precision: 78, scale: 0 })
  public avgRatio: string;

  @Column('decimal', { precision: 78, scale: 0 })
  public minRatio: string;

  @Column('decimal', { precision: 78, scale: 0 })
  public maxRatio: string;

  @Column('decimal', { precision: 78, scale: 8 })
  public avgPrice: string;

  @Column('decimal', { precision: 78, scale: 8 })
  public minPrice: string;

  @Column('decimal', { precision: 78, scale: 8 })
  public maxPrice: string;

  @Column('decimal', { precision: 78, scale: 8, nullable: true })
  public cap: string;

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
