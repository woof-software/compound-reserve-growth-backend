import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

import { History } from 'modules/history/history.entity';
import { Revenue } from 'modules/revenue/revenue.entity';
import { Treasury } from 'modules/treasury/treasury.entity';

@Entity({ name: 'source' })
export class Source {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column()
  public address: string;

  @Column({ nullable: true })
  public market: string;

  @Column()
  public algorithm: string;

  @Column()
  public blockNumber: number;

  @Column()
  public createdAt: Date;

  @Column({ nullable: true })
  public checkedAt?: Date;

  @OneToMany(() => History, (histories) => histories.source)
  public histories: History[];

  @OneToMany(() => Treasury, (treasuries) => treasuries.source)
  public treasuries: Treasury[];

  @OneToMany(() => Revenue, (revenues) => revenues.source)
  public revenues: Revenue[];

  constructor(address: string, algorithm: string, blockNumber: number, market?: string) {
    this.address = address;
    this.algorithm = algorithm;
    this.blockNumber = blockNumber;
    this.market = market;
    this.createdAt = new Date();
  }
}
