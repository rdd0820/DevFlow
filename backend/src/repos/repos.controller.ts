import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';

import {
  ReposService,
  type ConnectRepoInput,
  type SyncRepoInput,
} from './repos.service';

/**
 * 仓库连接、列表、同步、当前查看和删除。
 * 同步全部失败时返回 502，正文仍是同步结果。
 */
@Controller('api/repos')
export class ReposController {
  constructor(private readonly repos: ReposService) {}

  /** 已连接仓库，按最近变更倒序 */
  @Get()
  list() {
    return this.repos.list();
  }

  /** 连接 GitHub 仓库，并按请求立刻同步 */
  @Post('connect')
  connect(@Body() body: ConnectRepoInput): Promise<Record<string, unknown>> {
    return this.repos.connect(body ?? {});
  }

  /**
   * 刷新一个仓库。
   * limit 小于 1 时拒绝；不传表示全量。
   */
  @Post(':id/sync')
  async sync(
    @Param('id') id: string,
    @Body() body: SyncRepoInput,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (
      body?.limit != null &&
      (!Number.isInteger(body.limit) || body.limit < 1)
    ) {
      response.status(400);
      return { message: 'limit 必须是正数或空' };
    }
    const result = await this.repos.sync(id, body ?? {});
    if (result.status === 'failed') response.status(502);
    return result;
  }

  /** 设为当前查看，只更新排序时间 */
  @Post(':id/select')
  @HttpCode(200)
  select(@Param('id') id: string) {
    return this.repos.select(id);
  }

  /** 删除本系统里的仓库记录和已同步数据。不删除 GitHub 上的仓库 */
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.repos.remove(id);
  }

  /** 上次同步的状态和说明 */
  @Get(':id/sync-status')
  syncStatus(@Param('id') id: string) {
    return this.repos.syncStatus(id);
  }
}
