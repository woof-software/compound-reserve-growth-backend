import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { Source } from 'modules/source/source.entity';

@Entity({ name: 'liquidation_event' })
export class LiquidationEvent {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column()
  public blockNumber: number;

  @Column()
  public txHash: string;

  @Column()
  public liquidator: string;

  @Column()
  public tokenAddress: string; // Collateral token address

  @Column({ type: 'varchar', nullable: true })
  public priceFeed: string | null; // Price feed contract address

  @Column()
  public earnings: string; // USD value from event

  @Column()
  public date: Date; // Transaction date

  @CreateDateColumn({ type: 'timestamp with time zone' })
  public createdAt: Date; // Inserted at

  @ManyToOne(() => Source, (source) => source.reserves)
  public source: Source;

  constructor(
    source: Source,
    blockNumber: number,
    txHash: string,
    liquidator: string,
    tokenAddress: string,
    priceFeed: string | null,
    earnings: string,
    date: Date,
  ) {
    this.source = source;
    this.blockNumber = blockNumber;
    this.txHash = txHash.toLowerCase();
    this.liquidator = liquidator.toLowerCase();
    this.tokenAddress = tokenAddress.toLowerCase();
    this.priceFeed = priceFeed.toLowerCase();
    this.earnings = earnings;
    this.date = date;
  }
}
