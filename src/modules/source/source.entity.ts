import { Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

import { ReserveEntity, IncomesEntity, SpendsEntity } from 'modules/history/entities';
import { RevenueEntity } from 'modules/revenue/revenue.entity';
import { TreasuryEntity } from 'modules/treasury/treasury.entity';
import { AssetEntity } from 'modules/asset/asset.entity';

import { Source } from '@/common/types/source';

@Entity({ name: 'source' })
export class SourceEntity implements Source {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column()
  public address: string;

  @Column()
  public network: string;

  @Column({ nullable: true })
  public market: string;

  @Column({ nullable: true })
  public type: string;

  @Column('text', { array: true })
  public algorithm: string[];

  @Column()
  public startBlock: number;

  @Column({ nullable: true })
  public endBlock: number | null;

  @Column()
  public createdAt: Date;

  @Column({ nullable: true })
  public checkedAt?: Date;

  @ManyToOne(() => AssetEntity, (asset) => asset.sources)
  public asset: AssetEntity;

  @OneToMany(() => ReserveEntity, (reserves) => reserves.source)
  public reserves: ReserveEntity[];

  @OneToMany(() => TreasuryEntity, (treasuries) => treasuries.source)
  public treasuries: TreasuryEntity[];

  @OneToMany(() => RevenueEntity, (revenues) => revenues.source)
  public revenues: RevenueEntity[];

  @OneToMany(() => IncomesEntity, (incomes) => incomes.source)
  public incomes: IncomesEntity[];

  @OneToMany(() => SpendsEntity, (spends) => spends.source)
  public spends: SpendsEntity[];

  constructor(
    address: string,
    network: string,
    algorithm: string[],
    type: string,
    startBlock: number,
    asset: AssetEntity,
    market?: string,
    endBlock?: number,
  ) {
    this.address = address;
    this.network = network;
    this.algorithm = algorithm;
    this.type = type;
    this.startBlock = startBlock;
    this.endBlock = endBlock ?? null;
    this.asset = asset;
    this.market = market;
    this.createdAt = new Date();
  }
}
