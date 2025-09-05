import { Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

import { Reserve, Incomes, Spends } from 'modules/history/entity';
import { Revenue } from 'modules/revenue/revenue.entity';
import { Treasury } from 'modules/treasury/treasury.entity';
import { Asset } from 'modules/asset/asset.entity';

@Entity({ name: 'source' })
export class Source {
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

  @Column()
  public algorithm: string;

  @Column()
  public blockNumber: number;

  @Column()
  public createdAt: Date;

  @Column({ nullable: true })
  public checkedAt?: Date;

  @ManyToOne(() => Asset, (asset) => asset.sources)
  public asset: Asset;

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
    algorithm: string,
    type: string,
    blockNumber: number,
    asset: Asset,
    market?: string,
  ) {
    this.address = address;
    this.network = network;
    this.algorithm = algorithm;
    this.type = type;
    this.blockNumber = blockNumber;
    this.asset = asset;
    this.market = market;
    this.createdAt = new Date();
  }
}
