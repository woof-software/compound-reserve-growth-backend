import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { Source } from 'modules/source/source.entity';

@Entity({ name: 'incomes' })
export class Incomes {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column()
  public blockNumber: number;

  @Column({ type: 'numeric' })
  public quantitySupply: string;

  @Column({ type: 'numeric' })
  public quantityBorrow: string;

  @Column({ type: 'double precision' })
  public price: number; // USD

  @Column({ type: 'double precision' })
  public valueSupply: number; // USD

  @Column({ type: 'double precision' })
  public valueBorrow: number; // USD

  @Column()
  public date: Date;

  @Column()
  public createdAt: Date;

  @ManyToOne(() => Source, (source) => source.incomes)
  public source: Source;

  constructor(
    source: Source,
    blockNumber: number,
    quantitySupply: string,
    quantityBorrow: string,
    price: number,
    valueSupply: number,
    valueBorrow: number,
    date: Date,
  ) {
    this.source = source;
    this.blockNumber = blockNumber;
    this.quantitySupply = quantitySupply;
    this.quantityBorrow = quantityBorrow;
    this.price = price;
    this.valueSupply = valueSupply;
    this.valueBorrow = valueBorrow;
    this.date = date;
    this.createdAt = new Date();
  }
}
