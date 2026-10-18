import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from 'pg';

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
 * 数据库连接。
 * 开发期用 synchronize 按实体建表，不写迁移；连接的是本机已经在跑的 Postgres。
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const databaseUrl = config.getOrThrow<string>('DATABASE_URL');
        await prepareDatabase(databaseUrl);
        return {
          type: 'postgres' as const,
          url: databaseUrl,
          autoLoadEntities: true,
          synchronize: true,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
