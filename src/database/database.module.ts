import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isTest = configService.get('database.environment') === 'test';

        return {
          type: 'postgres',
          host: configService.get('database.host'),
          port: configService.get('database.port'),
          database: configService.get('database.name'),
          username: configService.get('database.user'),
          password: configService.get('database.password'),
          entities: [__dirname + '/../**/**/*.entity.{js,ts}'],
          migrations: [__dirname + '/migrations/*.{js,ts}'],
          migrationsTableName: 'migrations',
          synchronize: isTest,
          dropSchema: isTest,
          logging: !isTest,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
