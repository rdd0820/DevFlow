import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

import { githubIdTransformer } from '../github-id';

/**
 * PR 行级评审评论。
 * 每次成功拉到评论后，先删掉该 PR 的旧行再插入。
 * 各列由同步写入，属性用明确赋值断言。
 */
@Entity({ name: 'pr_review_comments' })
export class PrReviewComment {
  /** 本地主键 */
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** 所属 PR */
  @Index('ix_pr_review_comments_pr_id')
  @Column({ name: 'pr_id', type: 'uuid' })
  prId!: string;

  /** 远端评论标识 */
  @Column({
    name: 'github_comment_id',
    type: 'bigint',
    nullable: true,
    transformer: githubIdTransformer,
  })
  githubCommentId!: number | null;

  /** 评论正文 */
  @Column({ type: 'text', nullable: true })
  body!: string | null;

  /** 评论所在文件 */
  @Column({ type: 'varchar', length: 500, nullable: true })
  path!: string | null;

  /** 评论行。优先用 line，没有时用 original_line */
  @Column({ type: 'int', nullable: true })
  line!: number | null;

  /** 作者登录名 */
  @Column({ type: 'varchar', length: 200, nullable: true })
  author!: string | null;

  /** 远端创建时间 */
  @Column({ name: 'created_at', type: 'timestamptz', nullable: true })
  createdAt!: Date | null;

  /** 远端更新时间 */
  @Column({ name: 'updated_at', type: 'timestamptz', nullable: true })
  updatedAt!: Date | null;
}
