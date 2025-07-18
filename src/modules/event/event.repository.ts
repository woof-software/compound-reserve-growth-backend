import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Event } from './event.entity';

@Injectable()
export class EventRepository {
  constructor(
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
  ) {}

  async findById(id: number): Promise<Event> {
    return this.eventRepository.findOne({ where: { id } });
  }

  async findByName(name: string): Promise<Event> {
    return this.eventRepository.findOne({ where: { name } });
  }

  async list(): Promise<Event[]> {
    return this.eventRepository.find({
      order: { id: 'ASC' },
    });
  }

  async save(event: Event): Promise<Event> {
    return this.eventRepository.save(event);
  }
}
