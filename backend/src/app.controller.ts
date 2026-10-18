import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** 进程存活检查。不访问数据库，只说明服务已经起来 */
@Controller()
export class AppController {
  constructor(private readonly config: ConfigService) {}

  /**
   * 返回服务状态和应用名。
   * 负载均衡或本地启动脚本用它判断进程是否接受请求。
   */
  @Get('health')
  health(): { status: 'ok'; app: string } {
    return {
      status: 'ok',
      app: this.config.get<string>('APP_NAME') ?? 'DevFlow AI',
    };
  }
}
