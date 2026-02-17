import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

import { SourceEntity } from 'modules/source/source.entity';
import { Oracle } from 'modules/oracle/oracle.entity';

import { Asset } from '@/common/types/asset';

@Entity({ name: 'asset' })
export class AssetEntity implements Asset {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column()
  public address: string;

  @Column()
  public decimals: number;

  @Column()
  public symbol: string;

  @Column()
  public network: string;

  @Column({ nullable: true })
  public type: string;

  @Column()
  public createdAt: Date;

  @OneToMany(() => SourceEntity, (sources) => sources.asset)
  public sources: SourceEntity[];

  @OneToMany(() => Oracle, (oracles) => oracles.asset)
  public oracles: Oracle[];

  constructor(address: string, decimals: number, symbol: string, network: string, type?: string) {
    this.address = address;
    this.decimals = decimals;
    this.symbol = symbol;
    this.network = network;
    this.type = type;
    this.createdAt = new Date();
  }
}
