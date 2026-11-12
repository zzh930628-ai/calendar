import { Module } from '@nestjs/common';
import { ScheduleEventsController } from './schedule-events.controller';
import { ScheduleEventsService } from './schedule-events.service';

@Module({
  controllers: [ScheduleEventsController],
  providers: [ScheduleEventsService],
  exports: [ScheduleEventsService],
})
export class ScheduleEventsModule {}
