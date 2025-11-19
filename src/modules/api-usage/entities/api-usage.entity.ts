import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'api_key_usage_events' })
@Index(['apiKey', 'createdAt'])
export class ApiKeyUsageEvent {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column({ type: 'varchar', length: 64 })
  public apiKey: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  public clientName?: string;

  @Column({ type: 'varchar', length: 10 })
  public method: string;

  @Column({ type: 'text' })
  public targetUrl: string;

  @Column({ type: 'int' })
  public statusCode: number;

  @Column({ type: 'varchar', length: 64, nullable: true })
  public ip?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  public domain?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  public host?: string;

  @Column({ type: 'timestamptz' })
  public occurredAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  public createdAt: Date;
}
