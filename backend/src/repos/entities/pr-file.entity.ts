import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 一次同步看到的 PR 变更文件。
 * 每次成功拉到文件列表后，先删掉该 PR 的旧行再插入。
 * 各列由同步写入，属性用明确赋值断言。
 */
@Entity({ name: 'pr_files' })
export class PrFile {
  /** 本地主键 */
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** 所属 PR */
  @Index('ix_pr_files_pr_id')
  @Column({ name: 'pr_id', type: 'uuid' })
  prId!: string;

  /** 仓库内路径 */
  @Column({ type: 'varchar', length: 500 })
  filename!: string;

  /** added、modified、removed 等远端状态 */
  @Column({ type: 'varchar', length: 50 })
  status!: string;

  /** 新增行数 */
  @Column({ type: 'int', default: 0 })
  additions!: number;

  /** 删除行数 */
  @Column({ type: 'int', default: 0 })
  deletions!: number;

  /** diff 文本。过大或二进制时远端可能不给 */
  @Column({ type: 'text', nullable: true })
  patch!: string | null;
}
