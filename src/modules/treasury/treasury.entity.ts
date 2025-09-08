import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { Source } from 'modules/source/source.entity';

@Entity({ name: 'treasury' })
export class Treasury {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column()
  public blockNumber: number;

  @Column({ type: 'numeric' })
  public quantity: string;

  @Column({ type: 'double precision' })
  public price: number; // USD

  @Column({ type: 'double precision' })
  public value: number; // USD

  @Column()
  public date: Date;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  public createdAt: Date;

  @ManyToOne(() => Source, (source) => source.reserves)
  public source: Source;

  constructor(
    source: Source,
    blockNumber: number,
    quantity: string,
    price: number,
    value: number,
    date: Date,
  ) {
    this.source = source;
    this.blockNumber = blockNumber;
    this.quantity = quantity;
    this.price = price;
    this.value = value;
    this.date = date;
  }
}
