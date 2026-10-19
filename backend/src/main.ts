import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const config = app.get(ConfigService);

  // 回写请求来源，任意网页都可以调用接口。
  app.enableCors({ origin: true, credentials: true });

  await app.listen(
    Number(config.get<string>('API_PORT') ?? 3010),
    config.get<string>('API_HOST') ?? '0.0.0.0',
  );
}

bootstrap();
