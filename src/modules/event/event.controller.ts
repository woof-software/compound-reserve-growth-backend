import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  Controller,
  Injectable,
  HttpStatus,
  HttpCode,
  Get,
  NotFoundException,
} from '@nestjs/common';

import { ApiKeyEndpoint } from 'modules/api-key/decorators/api-key-endpoint';

import { EventService } from './event.service';
import { EventResponse } from './response/event.response';

@Injectable()
@Controller('events')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @ApiKeyEndpoint()
  @ApiOperation({ summary: 'Get event list' })
  @ApiResponse({ type: [EventResponse] })
  @HttpCode(HttpStatus.OK)
  @Get()
  async getEventList(): Promise<EventResponse[]> {
    const events = await this.eventService.listAll();
    if (!events || events.length === 0) throw new NotFoundException('No events found');
    return events.map((event) => new EventResponse(event));
  }
}
