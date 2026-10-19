import { EntityManager } from 'typeorm';

import { Issue } from './entities/issue.entity';
import { PrFile } from './entities/pr-file.entity';
import { PrReviewComment } from './entities/pr-review-comment.entity';
import { PullRequest } from './entities/pull-request.entity';
import { Repository } from './entities/repository.entity';
import { GithubHttpError, type PaginatedList } from './github/client';
import {
  listIssues,
  listPullRequestComments,
  listPullRequestFiles,
  listPullRequests,
} from './github/resources';

/** 一次同步要拉哪些数据源，以及每个源的条数上限。null 表示跟随分页直到结束 */
export type SyncRequest = {
  /** 是否同步 Issue */
  syncIssues: boolean;
  /** 是否同步 Pull Request，含文件和评审评论 */
  syncPullRequests: boolean;
  /** 每个列表过滤后的条数上限。子资源不使用这个上限 */
  limit: number | null;
};

/** 单个数据源的结果。skipped 表示这次没有选择它 */
export type SourceState = {
  /** skipped、completed、empty、partial、failed 之一 */
  status: string;
  /** 写入或看到的条数。列表失败时为 0 */
  count: number;
  /** 列表是否拿全。失败或截断时为 false */
  complete: boolean;
  /** 列表请求页数。失败时保持进入失败前的值 */
  pages: number;
};

/** 返回给连接和刷新接口的同步结果 */
export type SyncResult = {
  /** 仓库主键 */
  repo_id: string;
  /** 总状态 */
  status: string;
  /** 各类实际处理的条数 */
  synced: { issues: number; pull_requests: number };
  /** 各数据源的状态 */
  sources: Record<string, SourceState>;
  /** 失败原因。子请求带路径，例如 pull_requests/#1/files */
  errors: string[];
  /** 给页面看的一句说明 */
  message: string;
};

const STATUS_MESSAGE: Record<string, string> = {
  completed: '已完成所选数据源的全部分页同步。',
  empty: '所选数据源请求成功，但未返回记录；不能据此判断仓库健康。',
  partial: '同步不完整：存在请求失败或数量上限，请查看各数据源状态。',
  failed: '同步失败，未获取到有效的新数据；保留已有数据。',
  skipped: '未选择数据源，没有执行同步。',
};

/**
 * 把一次列表或子请求的失败记到数据源上。
 * 子请求失败把该源降为 partial；列表本身失败记为 failed。
 *
 * @param source 要修改的数据源状态
 * @param hasDetail 为 true 表示失败的是文件或评论，而不是主列表
 */
export function markSourceFailure(source: SourceState, hasDetail: boolean): void {
  source.status = hasDetail ? 'partial' : 'failed';
  source.complete = false;
}

/**
 * 根据各数据源状态得到总状态。
 * 全跳过为 skipped；所选源全失败为 failed；有失败或截断为 partial；有数据为 completed，否则 empty。
 *
 * @param sources 两个数据源的状态
 * @param synced 实际写入条数
 */
export function resolveSyncStatus(
  sources: Record<string, SourceState>,
  synced: SyncResult['synced'],
): string {
  const requested = Object.values(sources).filter((item) => item.status !== 'skipped');
  if (!requested.length) return 'skipped';
  if (requested.every((item) => item.status === 'failed')) return 'failed';
  if (requested.some((item) => item.status === 'failed' || item.status === 'partial')) return 'partial';
  return Object.values(synced).some((count) => count > 0) ? 'completed' : 'empty';
}

/**
 * 同步一个仓库的 Issue 和 Pull Request。
 * 远端删除不会删本地行。只有总状态为 completed 或 empty 时更新 lastSyncAt。
 *
 * @param manager 当前事务或连接
 * @param repo 已保存的仓库。请求固定发往 GitHub 官方接口
 * @param request 数据源开关和条数上限
 * @param token 仓库或全局 token。为空时匿名访问
 */
export async function syncRepository(
  manager: EntityManager,
  repo: Repository,
  request: SyncRequest,
  token: string | null,
): Promise<SyncResult> {
  const synced = { issues: 0, pull_requests: 0 };
  const sources: Record<string, SourceState> = {
    issues: { status: 'skipped', count: 0, complete: false, pages: 0 },
    pull_requests: { status: 'skipped', count: 0, complete: false, pages: 0 },
  };
  const errors: string[] = [];
  const target = { baseUrl: 'https://api.github.com', token };

  /**
   * 拉一个列表或子资源。失败时写入 errors，并按是否子请求更新数据源状态。
   *
   * @param source 数据源名
   * @param detail 子请求说明。主列表不传
   * @param loader 实际请求
   */
  async function fetchSource(
    source: string,
    detail: string | null,
    loader: () => Promise<PaginatedList>,
  ): Promise<PaginatedList | null> {
    try {
      const items = await loader();
      if (!detail) {
        sources[source] = {
          status: items.complete ? (items.items.length ? 'completed' : 'empty') : 'partial',
          count: items.items.length,
          complete: items.complete,
          pages: items.pages,
        };
      }
      return items;
    } catch (error) {
      const reason = error instanceof GithubHttpError ? error.message : error instanceof Error ? error.name : 'Error';
      errors.push(`${source}${detail ? `/${detail}` : ''}: ${reason}`);
      markSourceFailure(sources[source], Boolean(detail));
      return null;
    }
  }

  if (request.syncIssues) {
    const remote = await fetchSource('issues', null, () => listIssues(target, repo.owner, repo.name, request.limit));
    for (const item of listOf(remote)) {
      const githubIssueId = numberOf(item.id);
      let issue = githubIssueId == null
        ? null
        : await manager.findOne(Issue, { where: { repoId: repo.id, githubIssueId } });
      if (!issue) {
        issue = manager.create(Issue, {
          repoId: repo.id,
          githubIssueId,
          number: numberOf(item.number) ?? 0,
          title: textOf(item.title) || '',
        });
      }
      issue.number = numberOf(item.number) ?? issue.number;
      issue.title = textOf(item.title) || issue.title;
      issue.body = textOf(item.body);
      issue.state = textOf(item.state) || 'open';
      issue.labels = labelsOf(item.labels);
      issue.author = loginOf(item.user);
      issue.assignees = assigneesOf(item.assignees);
      issue.createdAt = dateOf(item.created_at);
      issue.updatedAt = dateOf(item.updated_at);
      issue.closedAt = dateOf(item.closed_at);
      await manager.save(issue);
      synced.issues += 1;
    }
  }

  if (request.syncPullRequests) {
    const remote = await fetchSource('pull_requests', null, () =>
      listPullRequests(target, repo.owner, repo.name, request.limit),
    );
    for (const item of listOf(remote)) {
      const githubPrId = numberOf(item.id);
      let pr = githubPrId == null
        ? null
        : await manager.findOne(PullRequest, { where: { repoId: repo.id, githubPrId } });
      if (!pr) {
        pr = manager.create(PullRequest, {
          repoId: repo.id,
          githubPrId,
          number: numberOf(item.number) ?? 0,
          title: textOf(item.title) || '',
        });
      }
      pr.number = numberOf(item.number) ?? pr.number;
      pr.title = textOf(item.title) || pr.title;
      pr.body = textOf(item.body);
      pr.state = textOf(item.state) || 'open';
      pr.author = loginOf(item.user);
      pr.baseBranch = refOf(item.base);
      pr.headBranch = refOf(item.head);
      pr.mergedAt = dateOf(item.merged_at);
      pr.createdAt = dateOf(item.created_at);
      pr.updatedAt = dateOf(item.updated_at);
      pr = await manager.save(pr);

      const files = await fetchSource('pull_requests', `#${pr.number}/files`, () =>
        listPullRequestFiles(target, repo.owner, repo.name, pr.number),
      );
      if (files) {
        await manager.delete(PrFile, { prId: pr.id });
        for (const fileItem of files.items) {
          await manager.save(
            manager.create(PrFile, {
              prId: pr.id,
              filename: textOf(fileItem.filename) || '',
              status: textOf(fileItem.status) || 'modified',
              additions: numberOf(fileItem.additions) ?? 0,
              deletions: numberOf(fileItem.deletions) ?? 0,
              patch: textOf(fileItem.patch),
            }),
          );
        }
      }

      const comments = await fetchSource('pull_requests', `#${pr.number}/comments`, () =>
        listPullRequestComments(target, repo.owner, repo.name, pr.number),
      );
      if (comments) {
        await manager.delete(PrReviewComment, { prId: pr.id });
        for (const commentItem of comments.items) {
          await manager.save(
            manager.create(PrReviewComment, {
              prId: pr.id,
              githubCommentId: numberOf(commentItem.id),
              body: textOf(commentItem.body),
              path: textOf(commentItem.path),
              line: numberOf(commentItem.line) ?? numberOf(commentItem.original_line),
              author: loginOf(commentItem.user),
              createdAt: dateOf(commentItem.created_at),
              updatedAt: dateOf(commentItem.updated_at),
            }),
          );
        }
      }
      synced.pull_requests += 1;
    }
  }

  const status = resolveSyncStatus(sources, synced);
  const now = new Date();
  if (status === 'completed' || status === 'empty') repo.lastSyncAt = now;
  const result: SyncResult = {
    repo_id: repo.id,
    status,
    synced,
    sources,
    errors,
    message: STATUS_MESSAGE[status],
  };
  repo.syncMetadata = { ...result, attempted_at: now.toISOString(), limit: request.limit };
  await manager.save(repo);
  return result;
}

/** 主列表成功时返回条目，失败时返回空数组 */
function listOf(value: PaginatedList | null): Record<string, unknown>[] {
  return value ? value.items : [];
}

/** 读取字符串字段。缺失或不是字符串时返回 null */
function textOf(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/** 读取数字字段。字符串数字也接受，其它情况返回 null */
function numberOf(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

/** 解析 GitHub 的 ISO 时间。空值和非法值返回 null */
function dateOf(value: unknown): Date | null {
  if (typeof value !== 'string' || !value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** 取用户对象上的 login */
function loginOf(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  return textOf((value as { login?: unknown }).login);
}

/** 标签名。没有 name 的项丢掉 */
function labelsOf(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (item && typeof item === 'object' ? textOf((item as { name?: unknown }).name) : null))
    .filter((item): item is string => Boolean(item));
}

/** 指派人登录名 */
function assigneesOf(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => loginOf(item)).filter((item): item is string => Boolean(item));
}

/** 取 base 或 head 上的分支名 */
function refOf(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  return textOf((value as { ref?: unknown }).ref);
}
