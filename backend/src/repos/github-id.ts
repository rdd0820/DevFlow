import type { ValueTransformer } from 'typeorm';

/**
 * GitHub 数字标识列的转换。
 * 数据库用 bigint 保存，读出时转成数字；空值保持 null。
 */
export const githubIdTransformer: ValueTransformer = {
  to: (value: number | null) => value,
  from: (value: string | number | null) => (value == null ? null : Number(value)),
};
