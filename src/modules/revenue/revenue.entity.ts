import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { SourceEntity } from 'modules/source/source.entity';

@Entity({ name: 'revenue' })
export class RevenueEntity {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column()
  public reserveId: number;

  @Column()
  public blockNumber: number;

  @Column({ type: 'numeric' })
  public quantityDelta: string;

  @Column({ type: 'double precision' })
  public price: number; // USD

  @Column({ type: 'double precision' })
  public value: number; // USD

  @Column()
  public date: Date;

  @Column()
  public createdAt: Date;

  @Column()
  public updatedAt: Date;

  @ManyToOne(() => SourceEntity, (source) => source.revenues)
  @JoinColumn({ name: 'sourceId' })
  public source: SourceEntity;
}
