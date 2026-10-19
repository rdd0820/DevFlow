import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from '../users/entities/user.entity';
import { AuditLog } from './entities/audit-log.entity';

/** 写入一条审计记录时调用方要提供的内容。未传的状态和快照使用空对象与 success */
export type WriteAuditInput = {
  /** 操作者。自动任务可以不传 */
  user?: User | null;
  /** 相关仓库标识。仓库表还不存在时也允许先记下 */
  repoId?: string | null;
  /** 动作名 */
  action: string;
  /** 对象类型 */
  targetType?: string | null;
  /** 对象标识 */
  targetId?: string | null;
  /** 结果状态，默认 success */
  status?: string;
  /** 请求快照 */
  requestJson?: Record<string, unknown> | null;
  /** 结果快照 */
  resultJson?: Record<string, unknown> | null;
};

/** 写入后能确认的记录标识 */
export type AuditLogRef = {
  id: string;
};

/**
 * 追加审计记录。
 * 通过审计实体写入，表由同步建表生成。
 */
@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly logs: Repository<AuditLog>,
  ) {}

  /**
   * 写入一条审计。
   * status 缺省为 success，两份 JSON 缺省为空对象。主键由数据库生成。
   */
  async write(input: WriteAuditInput): Promise<AuditLogRef> {
    const saved = await this.logs.save(
      this.logs.create({
        userId: input.user?.id ?? null,
        repoId: input.repoId ?? null,
        action: input.action,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        status: input.status ?? 'success',
        requestJson: input.requestJson ?? {},
        resultJson: input.resultJson ?? {},
      }),
    );
    return { id: saved.id };
  }
}
