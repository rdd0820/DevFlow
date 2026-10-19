import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditLog } from '../audit/entities/audit-log.entity';
import { Issue } from './entities/issue.entity';
import { PrFile } from './entities/pr-file.entity';
import { PrReviewComment } from './entities/pr-review-comment.entity';
import { PullRequest } from './entities/pull-request.entity';
import { Repository } from './entities/repository.entity';
import { ReposController } from './repos.controller';
import { ReposService } from './repos.service';
import { WebhookController } from './webhook.controller';

/**
 * 仓库连接和 GitHub 同步。
 * Webhook 与定时刷新也放在这里，它们只调用同一个同步入口。
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Repository,
      Issue,
      PullRequest,
      PrFile,
      PrReviewComment,
      AuditLog,
    ]),
  ],
  controllers: [ReposController, WebhookController],
  providers: [ReposService],
  exports: [ReposService],
})
export class ReposModule {}
