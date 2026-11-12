import { Controller, Get, Param } from '@nestjs/common';
import { ScheduleEventsService } from './schedule-events.service';

@Controller('schedule-events')
export class ScheduleEventsController {
  constructor(private readonly scheduleEventsService: ScheduleEventsService) {}

  @Get()
  findAll() {
    return this.scheduleEventsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.scheduleEventsService.findOne(id);
  }
}
