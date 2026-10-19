import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 按来源保存的一段文本。
 * 周报写 source_type 为 weekly_report 的一行，只存正文和元数据，这一步没有向量列。
 * 各列由写入方赋值，属性用明确赋值断言。
 */
@Entity({ name: 'documents' })
export class Document {
  /** 文档主键 */
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** 所属仓库。删除仓库时由仓库服务一并删掉 */
  @Index('ix_documents_repo_id')
  @Column({ name: 'repo_id', type: 'uuid' })
  repoId!: string;

  /** 来源种类。周报固定为 weekly_report，以后知识库还会写入其它种类 */
  @Index('ix_documents_source_type')
  @Column({ name: 'source_type', type: 'varchar', length: 80 })
  sourceType!: string;

  /** 来源记录标识。周报没有对应的业务行，每次生成用一个新的标识 */
  @Index('ix_documents_source_id')
  @Column({ name: 'source_id', type: 'uuid' })
  sourceId!: string;

  /** 标题，最长 500 字。周报标题带起止日期 */
  @Column({ type: 'varchar', length: 500 })
  title!: string;

  /** 正文。周报这里是完整 Markdown */
  @Column({ type: 'text' })
  content!: string;

  /**
   * 来源附带信息。
   * 列名保持 metadata。周报写入展示标题、日期、仓库名和生成时间。
   */
  @Column({ name: 'metadata', type: 'json', default: () => "'{}'" })
  meta!: Record<string, unknown>;

  /** 写入时间 */
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
