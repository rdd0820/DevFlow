import { Column, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * 已连接的代码仓库。
 * 按 fullName 去重。token 明文存放，列表接口不返回它。
 * 各列由数据库或同步写入，属性用明确赋值断言。
 */
@Entity({ name: 'repositories' })
export class Repository {
  /** 仓库主键 */
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** 所有者或命名空间 */
  @Index('ix_repositories_owner')
  @Column({ type: 'varchar', length: 200 })
  owner!: string;

  /** 仓库名，不含所有者 */
  @Index('ix_repositories_name')
  @Column({ type: 'varchar', length: 200 })
  name!: string;

  /** owner/name。连接时按它查找已有记录 */
  @Index('ix_repositories_full_name', { unique: true })
  @Column({ name: 'full_name', type: 'varchar', length: 400 })
  fullName!: string;

  /** 仓库 token。空 token 连接时不覆盖旧值，列表接口不返回 */
  @Column({ name: 'github_token', type: 'text', nullable: true })
  githubToken!: string | null;

  /** 仓库描述 */
  @Column({ type: 'text', nullable: true })
  description!: string | null;

  /** 默认分支 */
  @Column({ name: 'default_branch', type: 'varchar', length: 200, nullable: true })
  defaultBranch!: string | null;

  /** 最近一次完整或空结果同步的时间。失败和截断不更新 */
  @Column({ name: 'last_sync_at', type: 'timestamptz', nullable: true })
  lastSyncAt!: Date | null;

  /** 最近一次同步的状态、各数据源计数和错误 */
  @Column({ name: 'sync_metadata', type: 'json', nullable: true })
  syncMetadata!: Record<string, unknown> | null;

  /** 最近变更时间。设为当前查看时刷新它，列表按它倒序 */
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
