import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from 'pg';

import { AuditLog } from './audit/entities/audit-log.entity';
import { AuditModule } from './audit/audit.module';
import { Issue } from './repos/entities/issue.entity';
import { PrFile } from './repos/entities/pr-file.entity';
import { PrReviewComment } from './repos/entities/pr-review-comment.entity';
import { PullRequest } from './repos/entities/pull-request.entity';
import { Repository } from './repos/entities/repository.entity';
import { ReposModule } from './repos/repos.module';
import { Document } from './reports/entities/document.entity';
import { ReportsModule } from './reports/reports.module';
import { User } from './users/entities/user.entity';
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
 * 启动时同步建表的实体。
 * 各模块的表定义集中在这里注册，连接不再单独做模块。
 */
const entities = [
  User,
  AuditLog,
  Repository,
  Issue,
  PullRequest,
  PrFile,
  PrReviewComment,
  Document,
];

/**
 * 连接后、建表前准备数据库。
 * 先启用 vector，后面的文档表才能使用向量列。表本身由同步按实体创建。
 */
async function prepareDatabase(databaseUrl: string): Promise<void> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS vector');
  } finally {
    await client.end();
  }
}

/**
 * 应用根模块。
 * 按 NODE_ENV 加载对应环境文件，再按实体列表连接数据库。用户模块带上全局权限守卫。
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath:
        envFileByNodeEnv[process.env.NODE_ENV as keyof typeof envFileByNodeEnv] || '.env',
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const databaseUrl = config.getOrThrow<string>('DATABASE_URL');
        await prepareDatabase(databaseUrl);
        return {
          type: 'postgres' as const,
          url: databaseUrl,
          synchronize: true,
          entities,
        };
      },
    }),
    UsersModule,
    AuditModule,
    ReposModule,
    ReportsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
