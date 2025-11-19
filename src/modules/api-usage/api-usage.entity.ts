import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

import type { TRequestContextSnapshot } from './api-usage.types';

@Entity({ name: 'api_key_usage_events' })
@Index(['apiKey', 'createdAt'])
export class ApiKeyUsageEvent {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column({ type: 'integer', nullable: true })
  public apiKeyId?: number;

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

  @Column({ type: 'int', nullable: true })
  public durationMs?: number;

  @Column({ type: 'varchar', length: 64, nullable: true })
  public ip?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  public domain?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  public host?: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  public userAgent?: string;

  @Column({ type: 'jsonb', nullable: true })
  public requestContext?: TRequestContextSnapshot;

  @Column({ type: 'timestamptz' })
  public occurredAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  public createdAt: Date;
}
