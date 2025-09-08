import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'price' })
export class Price {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column()
  public symbol: string;

  @Column({ type: 'double precision' })
  public price: number; // USD

  @Column()
  public date: Date;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  public createdAt: Date;

  constructor(symbol: string, price: number, date: Date) {
    this.symbol = symbol;
    this.price = price;
    this.date = date;
  }
}
