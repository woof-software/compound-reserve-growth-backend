import { Logger } from '@nestjs/common';
import { Command, CommandRunner } from 'nest-commander';

import { EventService } from 'modules/event/event.service';
import { Event } from 'modules/event/event.entity';
import { events } from 'modules/event/constants/events';

@Command({ name: 'event:fill', description: 'Fill event table' })
export class EventFillCommand extends CommandRunner {
  private readonly logger = new Logger(EventFillCommand.name);

  constructor(private readonly eventService: EventService) {
    super();
  }

  async run() {
    try {
      this.logger.log('Starting to fill event table...');

      const dbEvents = await this.eventService.listAll();

      for (const event of events) {
        const eventDate = new Date(event.date);
        const existingEvent = dbEvents.find((e) => e.name === event.name && e.date === eventDate);
        if (existingEvent) continue;

        const newEvent = new Event(event.name, eventDate);

        await this.eventService.create(newEvent);
        this.logger.log(`Added new event: ${event.name}/${eventDate}`);
      }

      this.logger.log('Filling of event table completed.');
      return;
    } catch (error) {
      this.logger.error('An error occurred while filling event table:', error);
      return;
    }
  }
}
