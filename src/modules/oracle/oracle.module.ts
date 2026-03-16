import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { NetworkModule } from 'common/chains/network/network.module';

import { Oracle } from './oracle.entity';
import { OracleRepository } from './repositories/oracle.repository';
import { OracleService } from './oracle.service';

@Module({
  imports: [TypeOrmModule.forFeature([Oracle]), NetworkModule],
  providers: [OracleService, OracleRepository],
  exports: [OracleService, OracleRepository],
})
export class OracleModule {}
