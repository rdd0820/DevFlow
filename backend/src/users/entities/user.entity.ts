import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 当前安装对应的本地用户。
 * 没有登录流程，权限判断始终取创建时间最早的一行；不存在时由用户服务补上 demo-owner。
 * 各列由数据库写入，属性用明确赋值断言，不在构造函数里赋初值。
 */
@Entity({ name: 'users' })
export class User {
  /** 用户主键，新建时由数据库生成 */
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** 显示名。自动创建的第一位用户固定为 demo-owner */
  @Column({ type: 'varchar', length: 200, default: 'demo-user' })
  name!: string;

  /** 角色：owner、maintainer、developer、viewer。未知角色按 viewer 处理 */
  @Index('ix_users_role')
  @Column({ type: 'varchar', length: 80, default: 'owner' })
  role!: string;

  /** 用户自己的 GitHub token 密文。仓库 token 不放在这里 */
  @Column({ name: 'github_token_encrypted', type: 'text', nullable: true })
  githubTokenEncrypted!: string | null;

  /** 创建时间。最早的一行就是当前用户 */
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
