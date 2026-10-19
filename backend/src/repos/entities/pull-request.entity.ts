import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

import { githubIdTransformer } from '../github-id';

/**
 * 从 GitHub 同步来的一条 Pull Request。
 * 文件和评审评论挂在这条记录下，刷新时先删后插。
 * 各列由同步写入，属性用明确赋值断言。
 */
@Entity({ name: 'pull_requests' })
export class PullRequest {
  /** 本地主键 */
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** 所属仓库 */
  @Index('ix_pull_requests_repo_id')
  @Column({ name: 'repo_id', type: 'uuid' })
  repoId!: string;

  /** 远端 PR 标识。同一仓库下用它判断是更新还是新增 */
  @Column({
    name: 'github_pr_id',
    type: 'bigint',
    nullable: true,
    transformer: githubIdTransformer,
  })
  githubPrId!: number | null;

  /** PR 编号 */
  @Index('ix_pull_requests_number')
  @Column({ type: 'int' })
  number!: number;

  /** 标题 */
  @Column({ type: 'varchar', length: 500 })
  title!: string;

  /** 正文 */
  @Column({ type: 'text', nullable: true })
  body!: string | null;

  /** open、closed 或 merged 以外的远端 state */
  @Column({ type: 'varchar', length: 50, default: 'open' })
  state!: string;

  /** 作者登录名 */
  @Column({ type: 'varchar', length: 200, nullable: true })
  author!: string | null;

  /** 目标分支 */
  @Column({ name: 'base_branch', type: 'varchar', length: 200, nullable: true })
  baseBranch!: string | null;

  /** 来源分支 */
  @Column({ name: 'head_branch', type: 'varchar', length: 200, nullable: true })
  headBranch!: string | null;

  /** 合并时间。未合并时为空 */
  @Column({ name: 'merged_at', type: 'timestamptz', nullable: true })
  mergedAt!: Date | null;

  /** 远端创建时间 */
  @Column({ name: 'created_at', type: 'timestamptz', nullable: true })
  createdAt!: Date | null;

  /** 远端更新时间 */
  @Column({ name: 'updated_at', type: 'timestamptz', nullable: true })
  updatedAt!: Date | null;
}
