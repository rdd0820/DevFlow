import dayjs from 'dayjs';

/** 带分页覆盖信息的列表。complete 为 false 表示被 limit 截断或后面还有下一页 */
export type PaginatedList = {
  /** 过滤并截断后的记录 */
  items: Record<string, unknown>[];
  /** 是否已经拿全。还有下一页或本页被 limit 截断时为 false */
  complete: boolean;
  /** 实际请求的页数 */
  pages: number;
};

/**
 * 远端返回了 HTTP 错误。
 * message 带上状态码和说明，供连接失败提示和同步错误列表使用。
 */
export class GithubHttpError extends Error {
  /**
   * @param statusCode 响应状态码
   * @param detail 从正文或额度头整理出的说明。没有额外信息时为空
   * @param retryAt 额度恢复时间。不是限流时为空，调用方应停止后续请求
   */
  constructor(
    readonly statusCode: number,
    readonly detail: string | null = null,
    readonly retryAt: Date | null = null,
  ) {
    super(detail ? `HTTP ${statusCode}：${detail}` : `HTTP ${statusCode}`);
    this.name = 'GithubHttpError';
  }
}

/** 分页参数或 Link 头不合法时抛出。name 固定为 ValueError，方便和网络错误区分 */
function valueError(message: string): Error {
  const error = new Error(message);
  error.name = 'ValueError';
  return error;
}

/**
 * 组装 GitHub REST 请求头。
 * 有 token 时带 Bearer；没有时按匿名请求发送。
 *
 * @param token 仓库或全局 token。空字符串视为没有
 */
function githubHeaders(token?: string | null): Headers {
  const headers = new Headers({
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  });
  const key = token?.trim();
  if (key) headers.set('Authorization', `Bearer ${key}`);
  return headers;
}

/**
 * 从 Link 头取出 rel=next 的地址。
 * 没有下一页时返回 null。
 *
 * @param header 响应的 link 头
 */
function readNextLink(header: string | null): string | null {
  if (!header) return null;
  for (const part of header.split(',')) {
    const match = part.match(/<([^>]+)>\s*;\s*rel="next"/);
    if (match) return match[1];
  }
  return null;
}

/**
 * 按页拉取列表，直到没有下一页或条数达到 limit。
 * 每页固定请求 100 条。limit 只计算 include 留下的记录，不缩小页大小，
 * 否则小上限会把一次同步拆成大量请求，很快打满匿名额度。
 * 被 limit 截断或响应里还有下一页时，complete 为 false。
 *
 * @param input.baseUrl 接口根地址，末尾斜杠会被去掉
 * @param input.path 以 / 开头的路径
 * @param input.limit 过滤后的条数上限。null 表示跟随下一页直到结束
 * @param input.include 返回 false 的记录不计数，例如丢掉带 pull_request 的 Issue
 */
export async function getPaginated(input: {
  baseUrl: string;
  token?: string | null;
  path: string;
  params?: Record<string, string | number>;
  limit?: number | null;
  include?: (item: Record<string, unknown>) => boolean;
}): Promise<PaginatedList> {
  const limit = input.limit ?? null;
  if (limit !== null && limit < 1) throw valueError('limit 必须是正数或空');
  const first = new URL(`${input.baseUrl.replace(/\/$/, '')}${input.path}`);
  for (const [key, value] of Object.entries(input.params ?? {})) {
    first.searchParams.set(key, String(value));
  }
  first.searchParams.set('per_page', '100');

  const items: Record<string, unknown>[] = [];
  let url: string | null = first.toString();
  let pages = 0;

  while (url) {
    const response = await fetch(url, {
      headers: githubHeaders(input.token),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw await toGithubError(response);
    const resJson = await response.json();
    const accepted = readBatch(resJson).filter(
      (item) => !input.include || input.include(item),
    );
    pages += 1;
    const room = limit == null ? accepted.length : limit - items.length;
    const taken = accepted.slice(0, room);
    items.push(...taken);
    const nextUrl = readNextLink(response.headers.get('link'));
    if (!nextUrl || (limit != null && items.length >= limit)) {
      return {
        items,
        complete: !nextUrl && taken.length === accepted.length,
        pages,
      };
    }
    url = nextUrl;
  }
  return { items, complete: true, pages };
}

/**
 * 取出一页里的对象列表。响应根必须是对象数组。
 *
 * @param payload 响应 JSON
 */
function readBatch(payload: unknown): Record<string, unknown>[] {
  if (
    !Array.isArray(payload) ||
    payload.some(
      (item) => !item || typeof item !== 'object' || Array.isArray(item),
    )
  ) {
    throw valueError('GitHub 列表响应的形状不符合预期');
  }
  return payload as Record<string, unknown>[];
}

/**
 * 请求单个 JSON 对象，例如仓库详情。
 * 非 2xx 抛出 GithubHttpError。
 */
export async function getJson(input: {
  baseUrl: string;
  token?: string | null;
  path: string;
}): Promise<Record<string, unknown>> {
  const baseUrl = input.baseUrl.replace(/\/$/, '');
  const response = await fetch(`${baseUrl}${input.path}`, {
    headers: githubHeaders(input.token),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw await toGithubError(response);
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw valueError('GitHub 对象响应的形状不符合预期');
  }
  return payload as Record<string, unknown>;
}

/**
 * 把非 2xx 收成 GithubHttpError。
 * 额度用尽时写明是匿名还是 token、每小时上限和恢复时间，并带上 retryAt。
 * 其它错误尽量带上 GitHub 原文；正文不是 JSON 时只保留状态码。
 *
 * @param response 已经确认不是 2xx 的响应。正文会在这里读完
 */
async function toGithubError(response: Response): Promise<GithubHttpError> {
  const githubMessage = await readGithubMessage(response);
  const remaining = response.headers.get('x-ratelimit-remaining');
  const limit = Number(response.headers.get('x-ratelimit-limit'));
  const resetSeconds = Number(response.headers.get('x-ratelimit-reset'));
  const retryAt =
    Number.isFinite(resetSeconds) && resetSeconds > 0
      ? new Date(resetSeconds * 1000)
      : null;
  const rateLimited =
    (response.status === 403 || response.status === 429) && remaining === '0';
  if (rateLimited) {
    const when = retryAt ? `，约 ${formatReset(retryAt)} 恢复` : '';
    const hourly = Number.isFinite(limit) && limit > 0 ? limit : 60;
    const detail =
      hourly <= 60
        ? `当前 IP 的匿名额度已用完（每小时 ${hourly} 次${when}）。公开仓库在额度用完后也要填写 Access Token`
        : `Access Token 的额度已用完（每小时 ${hourly} 次${when}）。请等额度恢复后再连接`;
    return new GithubHttpError(response.status, detail, retryAt);
  }
  if (response.status === 401) {
    return new GithubHttpError(response.status, 'Access Token 无效或已过期');
  }
  return new GithubHttpError(response.status, githubMessage);
}

/**
 * 读取 GitHub 错误正文里的 message。
 * 没有这段、或正文不是 JSON 时返回 null。
 *
 * @param response 失败响应
 */
async function readGithubMessage(response: Response): Promise<string | null> {
  try {
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
    const message = (payload as { message?: unknown }).message;
    return typeof message === 'string' && message.trim() ? message.trim() : null;
  } catch {
    return null;
  }
}

/**
 * 额度恢复时间，用本机时区显示到分钟。
 *
 * @param date x-ratelimit-reset 对应的时间
 */
function formatReset(date: Date): string {
  return dayjs(date).format('M/D HH:mm');
}
