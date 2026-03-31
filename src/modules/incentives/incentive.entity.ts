import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { SourceEntity } from '@/modules/source/source.entity';

@Entity({ name: 'incentives' })
export class IncentiveEntity {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column({ nullable: true })
  public reserveId: number | null;

  @Column({ nullable: true })
  public spendId: number | null;

  @Column({ type: 'double precision' })
  public incomes: number;

  @Column({ type: 'double precision' })
  public rewardsSupply: number;

  @Column({ type: 'double precision' })
  public rewardsBorrow: number;

  @Column({ type: 'double precision' })
  public priceComp: number;

  @Column()
  public date: Date;

  @Column()
  public createdAt: Date;

  @Column()
  public updatedAt: Date;

  @ManyToOne(() => SourceEntity, (source) => source.incentives)
  @JoinColumn({ name: 'sourceId' })
  public source: SourceEntity;
}
