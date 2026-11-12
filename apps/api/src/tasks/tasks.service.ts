import { Injectable } from '@nestjs/common';

@Injectable()
export class TasksService {
  findAll() {
    return {
      items: [
        {
          id: 'task-1',
          title: '客户沟通',
          status: 'IN_PROGRESS',
          priority: 'HIGH',
          dueAt: '2026-11-11T11:00:00.000Z',
        },
      ],
    };
  }

  findOne(id: string) {
    return {
      id,
      title: '客户沟通',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      dueAt: '2026-11-11T11:00:00.000Z',
    };
  }
}
