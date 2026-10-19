import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

import { githubIdTransformer } from '../github-id';

/**
 * 从 GitHub 同步来的一条 Issue。
 * 含 pull_request 字段的条目在拉取时丢掉，不写进这张表。
 * 各列由同步写入，属性用明确赋值断言。
 */
@Entity({ name: 'issues' })
export class Issue {
  /** 本地主键 */
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** 所属仓库 */
  @Index('ix_issues_repo_id')
  @Column({ name: 'repo_id', type: 'uuid' })
  repoId!: string;

  /** 远端 Issue 标识。同一仓库下用它判断是更新还是新增 */
  @Column({
    name: 'github_issue_id',
    type: 'bigint',
    nullable: true,
    transformer: githubIdTransformer,
  })
  githubIssueId!: number | null;

  /** Issue 编号 */
  @Index('ix_issues_number')
  @Column({ type: 'int' })
  number!: number;

  /** 标题 */
  @Column({ type: 'varchar', length: 500 })
  title!: string;

  /** 正文 */
  @Column({ type: 'text', nullable: true })
  body!: string | null;

  /** open 或 closed */
  @Column({ type: 'varchar', length: 50, default: 'open' })
  state!: string;

  /** 标签名列表 */
  @Column({ type: 'json', default: () => "'[]'" })
  labels!: string[];

  /** 作者登录名 */
  @Column({ type: 'varchar', length: 200, nullable: true })
  author!: string | null;

  /** 指派人登录名 */
  @Column({ type: 'json', default: () => "'[]'" })
  assignees!: string[];

  /** 远端创建时间 */
  @Column({ name: 'created_at', type: 'timestamptz', nullable: true })
  createdAt!: Date | null;

  /** 远端更新时间 */
  @Column({ name: 'updated_at', type: 'timestamptz', nullable: true })
  updatedAt!: Date | null;

  /** 远端关闭时间。未关闭时为空 */
  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt!: Date | null;
}
