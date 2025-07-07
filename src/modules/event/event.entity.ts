import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'event' })
export class Event {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column()
  public name: string;

  @Column()
  public date: Date;

  @Column()
  public createdAt: Date;

  constructor(name: string, date: Date) {
    this.name = name;
    this.date = date;
    this.createdAt = new Date();
  }
}
