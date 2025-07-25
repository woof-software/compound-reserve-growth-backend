import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  Index,
} from 'typeorm';

@Entity('oracles')
@Unique(['address'])
export class Oracle {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index()
  address: string;

  @Column()
  chainId: number;

  @Column()
  network: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  ratioProvider: string;

  @Column({ nullable: true })
  baseAggregator: string;

  @Column({ type: 'int', nullable: true })
  maxYearlyRatioGrowthPercent: number;

  @Column('decimal', { precision: 78, scale: 0, nullable: true })
  snapshotRatio: string;

  @Column({ type: 'bigint', nullable: true })
  snapshotTimestamp: number;

  @Column({ type: 'int', nullable: true })
  minimumSnapshotDelay: number;

  @Column({ type: 'int', nullable: true })
  decimals: number;

  @Column({ nullable: true })
  manager: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  discoveredAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
