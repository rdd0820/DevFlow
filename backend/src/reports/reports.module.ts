import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Issue } from '../repos/entities/issue.entity';
import { PullRequest } from '../repos/entities/pull-request.entity';
import { Repository } from '../repos/entities/repository.entity';
import { Document } from './entities/document.entity';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

/**
 * 研发周报。
 * 读取已同步的 Issue 和 Pull Request，把生成的 Markdown 写入文档表。
 */
@Module({
  imports: [TypeOrmModule.forFeature([Repository, Issue, PullRequest, Document])],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
