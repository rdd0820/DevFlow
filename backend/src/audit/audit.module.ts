import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditLog } from '../database/entities/audit-log.entity';
import { AuditService } from './audit.service';

/**
 * 审计写入。
 * 其它模块需要记一笔操作时导入本模块，并注入审计服务。
 */
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
