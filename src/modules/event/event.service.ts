import { Injectable, NotFoundException } from '@nestjs/common';

import { EventRepository } from './event.repository';
import { Event } from './event.entity';

@Injectable()
export class EventService {
  constructor(private readonly eventRepository: EventRepository) {}

  async create(event: Event): Promise<Event> {
    return this.eventRepository.save(event);
  }

  async findById(id: number): Promise<Event> {
    return this.eventRepository.findById(id);
  }

  async listAll(): Promise<Event[]> {
    const events = await this.eventRepository.list();
    if (!events || events.length === 0) throw new NotFoundException('No events found');
    return events;
  }
}
