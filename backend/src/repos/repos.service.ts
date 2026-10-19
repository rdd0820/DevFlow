import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AuditLog } from '../audit/entities/audit-log.entity';
import { Issue } from './entities/issue.entity';
import { PrFile } from './entities/pr-file.entity';
import { PrReviewComment } from './entities/pr-review-comment.entity';
import { PullRequest } from './entities/pull-request.entity';
import { Repository as RepoEntity } from './entities/repository.entity';
import { getRepo } from './github/resources';
import { syncRepository, type SyncRequest, type SyncResult } from './sync';

/** 连接仓库接口的请求体。字段名与页面提交的 JSON 一致 */
export type ConnectRepoInput = {
  /** 所有者 */
  owner?: string | null;
  /** 仓库名 */
  repo?: string | null;
  /** 访问 GitHub 的 token。公开仓库可以不传 */
  token?: string | null;
};

/** 刷新接口的请求体。limit 为 null 时全量分页 */
export type SyncRepoInput = {
  /** 是否同步 Issue */
  sync_issues?: boolean | null;
  /** 是否同步 PR */
  sync_pull_requests?: boolean | null;
  /** 每个列表的条数上限。不传或 null 表示全部 */
  limit?: number | null;
};

/** 列表和连接响应里的仓库。不包含 token */
export type RepoView = {
  id: string;
  owner: string;
  name: string;
  full_name: string;
  description: string | null;
  default_branch: string | null;
  last_sync_at: Date | null;
  sync_metadata: Record<string, unknown> | null;
  updated_at: Date | null;
};

/** 拉取 Issue 和 Pull Request 时固定使用的官方接口 */
const GITHUB_API_BASE = 'https://api.github.com';

/**
 * 仓库连接、列表、同步和删除。
 * 定时任务在启动 5 秒后开始，串行刷新已连接仓库。
 */
@Injectable()
export class ReposService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReposService.name);
  /** 停掉启动延迟或后续间隔 */
  private stopTimer: (() => void) | null = null;

  constructor(
    @InjectRepository(RepoEntity)
    private readonly repos: Repository<RepoEntity>,
    @InjectRepository(Issue)
    private readonly issues: Repository<Issue>,
    @InjectRepository(PullRequest)
    private readonly pullRequests: Repository<PullRequest>,
    @InjectRepository(PrFile)
    private readonly prFiles: Repository<PrFile>,
    @InjectRepository(PrReviewComment)
    private readonly reviewComments: Repository<PrReviewComment>,
    @InjectRepository(AuditLog)
    private readonly auditLogs: Repository<AuditLog>,
  ) {}

  /** 启动定时同步。启动 5 秒后执行第一次，之后按间隔重复 */
  onModuleInit(): void {
    const intervalMs =
      Math.max(
        Number(process.env.AUTO_SYNC_INTERVAL_SECONDS ?? 300) || 300,
        30,
      ) * 1000;
    const start = setTimeout(() => {
      this.syncAll();
      const timer = setInterval(() => this.syncAll(), intervalMs);
      this.stopTimer = () => clearInterval(timer);
    }, 5_000);
    this.stopTimer = () => clearTimeout(start);
  }

  /** 进程退出时取消尚未执行的定时同步 */
  onModuleDestroy(): void {
    this.stopTimer?.();
    this.stopTimer = null;
  }

  /**
   * 按所有者和仓库名连接 GitHub 仓库。
   * 先向 GitHub 确认仓库存在，失败则拒绝且不写入记录。确认后立刻同步。
   * 已存在的 fullName 会更新，空 token 不覆盖旧 token。
   */
  async connect(input: ConnectRepoInput): Promise<Record<string, unknown>> {
    const owner = clean(input.owner);
    const repoName = clean(input.repo);
    const token = clean(input.token);
    if (!owner || !repoName) {
      throw new BadRequestException('请同时填写所有者和仓库名。');
    }

    const baseUrl = GITHUB_API_BASE;

    let remote: Record<string, unknown>;
    try {
      remote = await getRepo({ baseUrl, token }, owner, repoName);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new BadRequestException(`仓库连接失败：${message}`);
    }

    const fullName = `${owner}/${repoName}`;
    let repo = await this.repos.findOne({ where: { fullName } });
    if (!repo) {
      repo = this.repos.create({ owner, name: repoName, fullName });
    }
    repo.owner = owner;
    repo.name = repoName;
    if (token) repo.githubToken = token;
    repo.description = textOf(remote.description) ?? repo.description ?? null;
    repo.defaultBranch =
      textOf(remote.default_branch) || repo.defaultBranch || 'main';
    repo = await this.repos.save(repo);

    const syncResult = await this.syncSaved(repo, {
      syncIssues: true,
      syncPullRequests: true,
      limit: 5,
    });

    return {
      repo_id: repo.id,
      full_name: repo.fullName,
      default_branch: repo.defaultBranch,
      connected: true,
      message: syncResult.message,
      sync_status: syncResult.status,
      synced: syncResult.synced,
      sync_details: syncResult,
    };
  }

  /**
   * 已连接仓库，按最近变更倒序。
   * 不返回 token。
   */
  async list(): Promise<RepoView[]> {
    const items = await this.repos.find({ order: { updatedAt: 'DESC' } });
    return items.map(toView);
  }

  /**
   * 按当前开关同步一个仓库。
   * 返回结果；调用方在 status 为 failed 时把 HTTP 状态改成 502。
   */
  async sync(id: string, input: SyncRepoInput): Promise<SyncResult> {
    const repo = await this.find(id);
    return this.syncSaved(repo, {
      syncIssues: input.sync_issues !== false,
      syncPullRequests: input.sync_pull_requests !== false,
      limit: input.limit ?? null,
    });
  }

  /**
   * 把仓库标成当前查看。
   * 只刷新 updatedAt，列表因此把它排到前面。
   */
  async select(
    id: string,
  ): Promise<{ repo_id: string; full_name: string; selected: true }> {
    const repo = await this.find(id);
    repo.updatedAt = new Date();
    await this.repos.save(repo);
    return { repo_id: repo.id, full_name: repo.fullName, selected: true };
  }

  /**
   * 删除仓库及其已同步的 Issue、PR 和审计。
   * 不删除远程 Git 仓库，也不删除尚未建立的其它业务表。
   */
  async remove(id: string): Promise<{ repo_id: string; deleted: true }> {
    const repo = await this.find(id);
    const prs = await this.pullRequests.find({
      where: { repoId: repo.id },
      select: { id: true },
    });
    const prIds = prs.map((item) => item.id);
    if (prIds.length) {
      await this.prFiles
        .createQueryBuilder()
        .delete()
        .where('pr_id IN (:...prIds)', { prIds })
        .execute();
      await this.reviewComments
        .createQueryBuilder()
        .delete()
        .where('pr_id IN (:...prIds)', { prIds })
        .execute();
    }
    await this.issues.delete({ repoId: repo.id });
    await this.pullRequests.delete({ repoId: repo.id });
    await this.auditLogs.delete({ repoId: repo.id });
    await this.repos.delete(repo.id);
    return { repo_id: id, deleted: true };
  }

  /**
   * 读取上次同步状态。
   * 没有 metadata 时，同步过记为 unknown，否则 not_started。
   */
  async syncStatus(id: string): Promise<Record<string, unknown>> {
    const repo = await this.find(id);
    const metadata = repo.syncMetadata;
    return {
      repo_id: repo.id,
      status:
        textOf(metadata?.status) ||
        (repo.lastSyncAt ? 'unknown' : 'not_started'),
      last_sync_at: repo.lastSyncAt,
      message:
        textOf(metadata?.message) ||
        (repo.lastSyncAt ? '缺少同步状态，请重新同步。' : '仓库还没有同步过。'),
      details: metadata,
    };
  }

  /** 按主键取仓库。不存在时 404 */
  private async find(id: string): Promise<RepoEntity> {
    const repo = await this.repos.findOne({ where: { id } });
    if (!repo) throw new NotFoundException('未找到仓库');
    return repo;
  }

  /**
   * 用仓库上保存的 token 同步。没有仓库 token 时使用环境变量里的全局 token。
   */
  private async syncSaved(
    repo: RepoEntity,
    request: SyncRequest,
  ): Promise<SyncResult> {
    const token = clean(repo.githubToken) || clean(process.env.GITHUB_TOKEN);
    return syncRepository(this.repos.manager, repo, request, token);
  }

  /** 串行同步全部已连接仓库。单个失败只记日志 */
  private async syncAll(): Promise<void> {
    const repos = await this.repos.find();
    const limit = autoSyncLimit();
    for (const repo of repos) {
      try {
        await this.syncSaved(repo, {
          syncIssues: true,
          syncPullRequests: true,
          limit,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`定时同步失败 ${repo.id}: ${message}`);
      }
    }
  }
}

/** 定时同步的条数上限。未配置时全量 */
function autoSyncLimit(): number | null {
  const raw = process.env.AUTO_SYNC_LIMIT?.trim();
  if (!raw) return null;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : null;
}

/** 去掉空白。空串视为没有填写 */
function clean(value: string | null | undefined): string | null {
  const text = value?.trim();
  return text ? text : null;
}

/** 读取可选字符串字段 */
function textOf(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

/** 列表使用的仓库字段。不带 token */
function toView(repo: RepoEntity): RepoView {
  return {
    id: repo.id,
    owner: repo.owner,
    name: repo.name,
    full_name: repo.fullName,
    description: repo.description,
    default_branch: repo.defaultBranch,
    last_sync_at: repo.lastSyncAt,
    sync_metadata: repo.syncMetadata,
    updated_at: repo.updatedAt,
  };
}
