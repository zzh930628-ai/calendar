import { Injectable } from '@nestjs/common';

@Injectable()
export class UsersService {
  findAll() {
    return {
      items: [
        {
          id: 'demo-user-1',
          name: '演示用户',
          email: 'demo@example.com',
          timezone: 'Asia/Shanghai',
        },
      ],
    };
  }

  findOne(id: string) {
    return {
      id,
      name: '演示用户',
      email: 'demo@example.com',
      timezone: 'Asia/Shanghai',
    };
  }
}
