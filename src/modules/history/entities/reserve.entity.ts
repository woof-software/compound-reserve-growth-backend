import { Column, Entity, Index, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import { SourceEntity } from '@/modules/source/source.entity';

@Entity({ name: 'reserves' })
@Index('UQ_reserves_sourceId_date', ['source', 'date'], { unique: true })
@Index('IDX_reserves_date_source_id', ['date', 'source', 'id'])
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

  @UpdateDateColumn()
  public updatedAt: Date;

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
