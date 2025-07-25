import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('oracle_snapshots')
@Index(['oracleAddress', 'timestamp'])
@Index(['chainId', 'oracleAddress', 'timestamp'])
export class Snapshot {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index()
  oracleAddress: string;

  @Column()
  oracleName: string;

  @Column()
  @Index()
  chainId: number;

  @Column('decimal', { precision: 78, scale: 0 })
  ratio: string;

  @Column('decimal', { precision: 78, scale: 0 })
  price: string;

  @Column('decimal', { precision: 78, scale: 0 })
  snapshotRatio: string;

  @Column('bigint')
  snapshotTimestamp: number;

  @Column()
  maxYearlyGrowthPercent: number;

  @Column()
  isCapped: boolean;

  @Column('decimal', { precision: 10, scale: 4 })
  currentGrowthRate: string;

  @Column({ nullable: true })
  blockNumber: number;

  @Column('jsonb', { nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  @Index()
  timestamp: Date;
}
