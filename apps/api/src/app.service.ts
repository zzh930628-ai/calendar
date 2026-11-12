import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      name: 'task-workbench-api',
      status: 'ok',
      message: 'API 服务已启动',
    };
  }
}
