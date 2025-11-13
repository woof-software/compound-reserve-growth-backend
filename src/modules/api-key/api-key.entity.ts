import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

import { ApiKeyStatus } from '@/common/enum/api-key-status.enum';

@Entity({ name: 'api_keys' })
export class ApiKey {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column({ length: 24 })
  @Index()
  public clientName: string;

  @Column({ name: 'key_hash', length: 64, unique: true })
  @Index()
  public keyHash: string;

  @Column('jsonb')
  public ipWhitelist: string[];

  @Column('jsonb')
  public domainWhitelist: string[];

  @Column({
    type: 'enum',
    enum: ApiKeyStatus,
    default: ApiKeyStatus.ACTIVE,
  })
  @Index()
  public status: ApiKeyStatus;

  @CreateDateColumn({ type: 'timestamp without time zone' })
  public createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp without time zone' })
  public updatedAt: Date;
}
