import { Injectable } from '@nestjs/common';

@Injectable()
export class ScheduleEventsService {
  findAll() {
    return {
      items: [
        {
          id: 'event-1',
          title: '客户沟通',
          origin: 'GOOGLE',
          startAt: '2026-11-11T09:30:00.000Z',
          endAt: '2026-11-11T10:30:00.000Z',
        },
      ],
    };
  }

  findOne(id: string) {
    return {
      id,
      title: '客户沟通',
      origin: 'GOOGLE',
      startAt: '2026-11-11T09:30:00.000Z',
      endAt: '2026-11-11T10:30:00.000Z',
    };
  }
}
