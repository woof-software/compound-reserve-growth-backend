import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'event' })
export class Event {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column()
  public name: string;

  @Column()
  public date: Date;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  public createdAt: Date;

  constructor(name: string, date: Date) {
    this.name = name;
    this.date = date;
  }
}
