import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('alerts')
@Index(['oracleAddress', 'chainId', 'timestamp'])
@Index(['type', 'status'])
export class Alert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  oracleAddress: string;

  @Column()
  @Index()
  chainId: number;

  @Column()
  type: string;

  @Column()
  severity: string;

  @Column()
  message: string;

  @Column('jsonb', { nullable: true })
  data: Record<string, any>;

  @Column({ default: 'pending' })
  status: string;

  @CreateDateColumn()
  @Index()
  timestamp: Date;

  @Column({ type: 'timestamp', nullable: true })
  sentAt: Date;

  @Column({ nullable: true })
  error: string;
}
