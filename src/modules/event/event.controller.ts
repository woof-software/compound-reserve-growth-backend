import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Controller, Injectable, HttpStatus, HttpCode, Get } from '@nestjs/common';

import { EventService } from './event.service';
import { EventResponse } from './response/event.response';

@Injectable()
@Controller('events')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @ApiOperation({ summary: 'Get event list' })
  @ApiResponse({ type: [EventResponse] })
  @HttpCode(HttpStatus.OK)
  @Get()
  async getEventList(): Promise<EventResponse[]> {
    const events = await this.eventService.listAll();
    return events.map((event) => new EventResponse(event));
  }
}
