import { ApiProperty } from '@nestjs/swagger';

import { Event } from 'modules/event/event.entity';

export class EventResponse {
  @ApiProperty({ example: 1 })
  public id: number;

  @ApiProperty({ example: 'Some event name' })
  public name: string;

  @ApiProperty({ example: 1750809600 })
  public date: number; // date in seconds

  constructor(event: Event) {
    this.id = event.id;
    this.name = event.name;
    this.date = new Date(event.date).getTime() / 1000;
  }
}
