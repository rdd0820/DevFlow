import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';

import { ReposService } from './repos.service';

/** 这些事件会触发一次后台同步。其它事件只确认收到 */
const SYNC_EVENTS = new Set(['issues', 'pull_request', 'push']);

/**
 * GitHub Webhook。
 * 配置了 GITHUB_WEBHOOK_SECRET 才校验签名；没配置时直接接受。
 */
@Controller('api/webhooks')
export class WebhookController {
  constructor(private readonly repos: ReposService) {}

  /**
   * 接收 GitHub 事件。
   * 仓库未连接时不报错，返回 accepted=false。匹配的事件在响应返回后同步。
   */
  @Post('github')
  @HttpCode(200)
  async github(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-github-event') event?: string,
    @Headers('x-hub-signature-256') signature?: string,
  ): Promise<Record<string, unknown>> {
    verifySignature(request.rawBody ?? Buffer.alloc(0), signature);
    const payload = (request.body ?? {}) as {
      repository?: { full_name?: string };
    };
    const fullName = payload.repository?.full_name;
    if (!fullName)
      return {
        accepted: false,
        reason: 'payload.repository.full_name is missing',
      };

    const repos = await this.repos.list();
    const repo = repos.find((item) => item.full_name === fullName);
    if (!repo)
      return { accepted: false, reason: `${fullName} is not connected` };

    if (event && SYNC_EVENTS.has(event)) {
      const limit = autoSyncLimit();
      this.repos
        .sync(repo.id, {
          sync_issues: true,
          sync_pull_requests: true,
          limit,
        })
        .catch(() => undefined);
      return {
        accepted: true,
        event,
        repo_id: repo.id,
        action: 'sync_scheduled',
      };
    }
    return {
      accepted: true,
      event: event ?? null,
      repo_id: repo.id,
      action: 'ignored',
    };
  }
}

/**
 * 校验 X-Hub-Signature-256。
 * 密钥未配置时不校验。签名缺失或不相等时 401。
 */
function verifySignature(body: Buffer, signature: string | undefined): void {
  const secret = process.env.GITHUB_WEBHOOK_SECRET?.trim();
  if (!secret) return;
  if (!signature?.startsWith('sha256='))
    throw new UnauthorizedException('缺少 GitHub webhook 签名');
  const expected = createHmac('sha256', secret).update(body).digest('hex');
  const actual = signature.slice('sha256='.length);
  const left = Buffer.from(expected);
  const right = Buffer.from(actual);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    throw new UnauthorizedException('GitHub webhook 签名无效');
  }
}

/** 与定时同步相同的条数上限。未配置时全量 */
function autoSyncLimit(): number | null {
  const raw = process.env.AUTO_SYNC_LIMIT?.trim();
  if (!raw) return null;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : null;
}
