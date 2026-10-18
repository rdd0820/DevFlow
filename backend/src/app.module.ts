import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuditModule } from './audit/audit.module';
import { DatabaseModule } from './database/database.module';
import { UsersModule } from './users/users.module';
import { AppController } from './app.controller';

/**
 * NODE_ENV 对应的环境文件。
 * 未设置或不是这三项时用开发配置 .env；文件都放在 backend 目录，启动时的工作目录也是这里。
 */
const envFileByNodeEnv = {
  production: '.env.production',
  test: '.env.test',
  development: '.env',
};

/**
 * 应用根模块。
 * 按 NODE_ENV 加载对应环境文件，再连接数据库。用户模块带上全局权限守卫。
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath:
        envFileByNodeEnv[process.env.NODE_ENV as keyof typeof envFileByNodeEnv] || '.env',
    }),
    DatabaseModule,
    UsersModule,
    AuditModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
