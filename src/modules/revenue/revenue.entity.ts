import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { Source } from 'modules/source/source.entity';
import { Asset } from 'modules/asset/asset.entity';

@Entity({ name: 'revenue' })
export class Revenue {
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

  @ManyToOne(() => Source, (source) => source.histories)
  public source: Source;

  @ManyToOne(() => Asset, (asset) => asset.histories)
  public asset: Asset;

  constructor(
    source: Source,
    asset: Asset,
    blockNumber: number,
    quantity: string,
    price: number,
    value: number,
    date: Date,
  ) {
    this.source = source;
    this.asset = asset;
    this.blockNumber = blockNumber;
    this.quantity = quantity;
    this.price = price;
    this.value = value;
    this.date = date;
    this.createdAt = new Date();
  }
}
