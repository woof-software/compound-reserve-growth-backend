import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

import { History } from 'modules/history/history.entity';
import { Treasury } from 'modules/treasury/treasury.entity';
import { Revenue } from 'modules/revenue/revenue.entity';

@Entity({ name: 'asset' })
export class Asset {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column()
  public address: string;

  @Column()
  public decimals: number;

  @Column()
  public symbol: string;

  @Column()
  public network: string;

  @Column()
  public type: string;

  @Column()
  public createdAt: Date;

  @OneToMany(() => History, (histories) => histories.asset)
  public histories: History[];

  @OneToMany(() => Treasury, (treasuries) => treasuries.asset)
  public treasuries: Treasury[];

  @OneToMany(() => Revenue, (revenues) => revenues.asset)
  public revenues: Revenue[];

  constructor(address: string, decimals: number, symbol: string, network: string, type: string) {
    this.address = address;
    this.decimals = decimals;
    this.symbol = symbol;
    this.network = network;
    this.type = type;
    this.createdAt = new Date();
  }
}
