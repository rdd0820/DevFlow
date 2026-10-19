import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';

import { ReportsService, type WeeklyReportRequest } from './reports.service';

/**
 * 研发周报接口。
 * 只根据已同步数据生成 Markdown，不分析、不调用大模型。
 * 已生成的周报可以按仓库列出和删除。
 */
@Controller('api/reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  /** 一个仓库已保存的周报，按写入时间倒序 */
  @Get()
  list(@Query('repo_id') repoId?: string) {
    return this.reports.list(repoId ?? '');
  }

  /** 按仓库和起止日期生成周报，并保存正文 */
  @Post('weekly')
  weekly(@Body() body: WeeklyReportRequest) {
    return this.reports.weekly(body ?? {});
  }

  /** 删除一份已保存的周报。不删除仓库本身 */
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.reports.remove(id);
  }
}
