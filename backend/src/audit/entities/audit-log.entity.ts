import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 一次操作的审计记录。只追加，不修改。
 * 仓库表还不存在时 repoId 只保存标识，不建外键。
 * 各列由数据库写入，属性用明确赋值断言，不在构造函数里赋初值。
 */
@Entity({ name: 'audit_logs' })
export class AuditLog {
  /** 记录主键，新建时由数据库生成 */
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** 操作者。自动任务可以为空 */
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null;

  /** 相关仓库标识。仓库表还不存在时也允许先记下 */
  @Column({ name: 'repo_id', type: 'uuid', nullable: true })
  repoId!: string | null;

  /** 动作名 */
  @Column({ type: 'varchar', length: 160 })
  action!: string;

  /** 对象类型 */
  @Column({ name: 'target_type', type: 'varchar', length: 100, nullable: true })
  targetType!: string | null;

  /** 对象标识 */
  @Column({ name: 'target_id', type: 'varchar', length: 120, nullable: true })
  targetId!: string | null;

  /** 结果状态，缺省为 success */
  @Column({ type: 'varchar', length: 80, default: 'success' })
  status!: string;

  /** 请求快照。缺省为空对象 */
  @Column({ name: 'request_json', type: 'json', default: {} })
  requestJson!: Record<string, unknown>;

  /** 结果快照。缺省为空对象 */
  @Column({ name: 'result_json', type: 'json', default: {} })
  resultJson!: Record<string, unknown>;

  /** 写入时间 */
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
