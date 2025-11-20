import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Event } from './event.entity';
import { EventRepository } from './event.repository';
import { EventService } from './event.service';
import { EventController } from './event.controller';
import { EventFillCommand } from './cli/event-fill.command';

import { ApiKeyGuardModule } from '@/common/guards/api-key';

@Module({
  imports: [TypeOrmModule.forFeature([Event]), ApiKeyGuardModule],
  providers: [EventRepository, EventService, EventFillCommand],
  exports: [EventService, EventRepository],
  controllers: [EventController],
})
export class EventModule {}
