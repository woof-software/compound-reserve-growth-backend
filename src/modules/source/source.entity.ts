import { Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

import { Reserve, Incomes, Spends } from 'modules/history/entities';
import { Revenue } from 'modules/revenue/revenue.entity';
import { Treasury } from 'modules/treasury/treasury.entity';
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

  @OneToMany(() => Reserve, (reserves) => reserves.source)
  public reserves: Reserve[];

  @OneToMany(() => Treasury, (treasuries) => treasuries.source)
  public treasuries: Treasury[];

  @OneToMany(() => Revenue, (revenues) => revenues.source)
  public revenues: Revenue[];

  @OneToMany(() => Incomes, (incomes) => incomes.source)
  public incomes: Incomes[];

  @OneToMany(() => Spends, (spends) => spends.source)
  public spends: Spends[];

  constructor(
    address: string,
    network: string,
    algorithm: string[],
    type: string,
    startBlock: number,
    asset: AssetEntity,
    market?: string,
    endBlock?: number | null,
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
