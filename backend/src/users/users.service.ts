import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from '../database/entities/user.entity';

/**
 * 维护「当前用户」这一行。
 * 没有登录，所有需要身份的操作都使用 users 表里创建时间最早的记录。
 */
@Injectable()
export class UsersService implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  /** 启动时保证至少有一位用户，避免第一次鉴权才发现表是空的 */
  async onModuleInit(): Promise<void> {
    await this.ensureDemoUser();
  }

  /**
   * 取得当前用户。
   * 表里还没有人时创建 name=demo-owner、role=owner 的一行，并把它作为以后的当前用户。
   */
  async ensureDemoUser(): Promise<User> {
    const [current] = await this.users.find({
      order: { createdAt: 'ASC' },
      take: 1,
    });
    if (current) return current;
    return this.users.save(this.users.create({ name: 'demo-owner', role: 'owner' }));
  }
}
