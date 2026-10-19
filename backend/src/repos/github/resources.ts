import { getJson, getPaginated, type PaginatedList } from './client';

/** 一次 GitHub 读取共用的地址和凭证 */
type GithubTarget = {
  /** 接口根地址 */
  baseUrl: string;
  /** 仓库 token。为空时匿名访问 */
  token?: string | null;
};

/**
 * 读取仓库详情。
 *
 * @param owner 所有者
 * @param repo 仓库名
 */
export function getRepo(target: GithubTarget, owner: string, repo: string): Promise<Record<string, unknown>> {
  return getJson({ ...target, path: `/repos/${owner}/${repo}` });
}

/**
 * 拉取 Issue。带 pull_request 字段的条目是 PR，不计入 limit。
 *
 * @param limit 过滤后的条数上限。null 表示全部
 */
export function listIssues(
  target: GithubTarget,
  owner: string,
  repo: string,
  limit: number | null,
): Promise<PaginatedList> {
  return getPaginated({
    ...target,
    path: `/repos/${owner}/${repo}/issues`,
    params: { state: 'all' },
    limit,
    include: (item) => !('pull_request' in item),
  });
}

/**
 * 拉取 Pull Request。
 *
 * @param limit 条数上限。null 表示全部
 */
export function listPullRequests(
  target: GithubTarget,
  owner: string,
  repo: string,
  limit: number | null,
): Promise<PaginatedList> {
  return getPaginated({
    ...target,
    path: `/repos/${owner}/${repo}/pulls`,
    params: { state: 'all' },
    limit,
  });
}

/**
 * 拉取某个 PR 的变更文件。不另设条数上限，跟随分页直到结束。
 *
 * @param number PR 编号
 */
export function listPullRequestFiles(
  target: GithubTarget,
  owner: string,
  repo: string,
  number: number,
): Promise<PaginatedList> {
  return getPaginated({ ...target, path: `/repos/${owner}/${repo}/pulls/${number}/files` });
}

/**
 * 拉取某个 PR 的行级评审评论。
 *
 * @param number PR 编号
 */
export function listPullRequestComments(
  target: GithubTarget,
  owner: string,
  repo: string,
  number: number,
): Promise<PaginatedList> {
  return getPaginated({ ...target, path: `/repos/${owner}/${repo}/pulls/${number}/comments` });
}
