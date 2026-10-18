import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PERMISSION_KEY, hasPermission } from '../common/permissions';
import { UsersService } from './users.service';

/**
 * 按路由上声明的权限检查当前用户。
 * 未声明权限的接口直接放行；权限不足时返回 403，正文里带上缺少的权限名。
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.getAllAndOverride<string | undefined>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!permission) return true;

    const user = await this.users.ensureDemoUser();
    if (!hasPermission(user.role, permission)) {
      throw new ForbiddenException(`需要权限：${permission}`);
    }
    return true;
  }
}
