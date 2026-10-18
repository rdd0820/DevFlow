import { SetMetadata } from '@nestjs/common';

/** 路由元数据键。守卫用它读取这个接口要求的权限名 */
export const PERMISSION_KEY = 'required_permission';

/**
 * 各角色允许的操作。
 * owner 拥有全部权限；maintainer 不能改设置；developer 不能同步仓库和确认草稿；viewer 只能查看仓库和评测。
 */
export const ROLE_PERMISSIONS: Record<string, ReadonlySet<string>> = {
  owner: new Set([
    'repo:read',
    'repo:sync',
    'agent:run',
    'draft:create',
    'draft:approve',
    'eval:read',
    'settings:manage',
  ]),
  maintainer: new Set([
    'repo:read',
    'repo:sync',
    'agent:run',
    'draft:create',
    'draft:approve',
    'eval:read',
  ]),
  developer: new Set(['repo:read', 'agent:run', 'draft:create', 'eval:read']),
  viewer: new Set(['repo:read', 'eval:read']),
};

/**
 * 判断角色是否具备某项权限。
 * 没有角色或角色不在表里时按 viewer 处理，避免未知角色意外拿到写权限。
 */
export function hasPermission(role: string | null | undefined, permission: string): boolean {
  const normalized = (role || 'viewer').toLowerCase();
  const granted = ROLE_PERMISSIONS[normalized] ?? ROLE_PERMISSIONS.viewer;
  return granted.has(permission);
}

/**
 * 声明这个接口需要的权限。
 * 没有加上这个装饰器的接口不做权限检查。
 */
export const RequirePermission = (permission: string) => SetMetadata(PERMISSION_KEY, permission);
