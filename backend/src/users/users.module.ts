import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from './entities/user.entity';
import { PermissionGuard } from './permission.guard';
import { UsersService } from './users.service';

/**
 * 当前用户和权限守卫。
 * 守卫全局生效，但只有声明了权限的接口才会拦截。
 */
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UsersService, { provide: APP_GUARD, useClass: PermissionGuard }],
  exports: [UsersService],
})
export class UsersModule {}
