import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { SourceEntity } from 'modules/source/source.entity';

@Entity({ name: 'reserves' })
export class ReserveEntity {
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

  @Column()
  public createdAt: Date;

  @ManyToOne(() => SourceEntity, (source) => source.reserves)
  public source: SourceEntity;

  constructor(
    source: SourceEntity,
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
    this.createdAt = new Date();
  }
}
