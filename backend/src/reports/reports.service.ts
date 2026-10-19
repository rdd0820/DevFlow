import { randomUUID } from 'crypto';

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import utc from 'dayjs/plugin/utc';
import { Repository } from 'typeorm';

import { Issue } from '../repos/entities/issue.entity';
import { PullRequest } from '../repos/entities/pull-request.entity';
import { Repository as RepoEntity } from '../repos/entities/repository.entity';
import { Document } from './entities/document.entity';
import {
  buildWeeklyMarkdown,
  issueInRange,
  pullRequestInRange,
} from './markdown';

/** 按 UTC 解析日历日，并允许指定 YYYY-MM-DD 格式 */
dayjs.extend(utc);
dayjs.extend(customParseFormat);

/** 周报请求和正文里的日期格式。严格按这个格式解析，2 月 31 日不会进位成 3 月 */
const REPORT_DATE_FORMAT = 'YYYY-MM-DD';

/** 生成周报的请求体。日期是 YYYY-MM-DD，按 UTC 日历日理解 */
export type WeeklyReportRequest = {
  /** 仓库主键 */
  repo_id?: string | null;
  /** 开始日期，含当天 */
  start_date?: string | null;
  /** 结束日期，含当天 */
  end_date?: string | null;
};

/**
 * 一份已保存的周报。
 * 列表和生成接口都返回这个形状，页面不用再为刚生成的那份单独请求正文。
 */
export type WeeklyReportRecord = {
  /** 文档主键，打开和删除都用它 */
  id: string;
  /** 展示标题，含起止日期 */
  title: string;
  /** 统计开始日，YYYY-MM-DD。元数据里没有这项时为 null */
  start_date: string | null;
  /** 统计结束日，YYYY-MM-DD。元数据里没有这项时为 null */
  end_date: string | null;
  /** 写入时间，ISO 字符串 */
  created_at: string;
  /** 完整 Markdown 正文 */
  report_markdown: string;
};

/** 周报在文档表里的来源种类。列表和删除只处理这一种 */
const WEEKLY_REPORT_SOURCE = 'weekly_report';

/**
 * 按仓库和时间窗汇总已同步的 Issue、Pull Request，并保存周报正文。
 * 不调用大模型。
 */
@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(RepoEntity)
    private readonly repos: Repository<RepoEntity>,
    @InjectRepository(Issue)
    private readonly issues: Repository<Issue>,
    @InjectRepository(PullRequest)
    private readonly pullRequests: Repository<PullRequest>,
    @InjectRepository(Document)
    private readonly documents: Repository<Document>,
  ) {}

  /**
   * 列出一个仓库已保存的周报。
   * 按写入时间倒序。仓库不存在时 404，未传仓库主键时 400。
   */
  async list(repoId: string): Promise<WeeklyReportRecord[]> {
    const repo = await this.findRepo(repoId);
    const items = await this.documents.find({
      where: { repoId: repo.id, sourceType: WEEKLY_REPORT_SOURCE },
      order: { createdAt: 'DESC' },
    });
    return items.map(toRecord);
  }

  /**
   * 删除一份周报。
   * 只删除 weekly_report 文档，不删除仓库和已同步的 Issue、Pull Request。
   */
  async remove(id: string): Promise<{ id: string; deleted: true }> {
    const document = await this.documents.findOne({
      where: { id, sourceType: WEEKLY_REPORT_SOURCE },
    });
    if (!document) throw new NotFoundException('未找到周报');
    await this.documents.delete(document.id);
    return { id: document.id, deleted: true };
  }

  /**
   * 生成一份周报。
   * 区间外的记录不进入正文。成功后新增一行 weekly_report 文档，并返回正文和列表所需字段。
   */
  async weekly(input: WeeklyReportRequest): Promise<WeeklyReportRecord> {
    const start = dayjs.utc(input.start_date ?? '', REPORT_DATE_FORMAT, true);
    const end = dayjs.utc(input.end_date ?? '', REPORT_DATE_FORMAT, true);
    if (!start.isValid())
      throw new BadRequestException('开始日期格式应为 YYYY-MM-DD');
    if (!end.isValid())
      throw new BadRequestException('结束日期格式应为 YYYY-MM-DD');
    if (start.isAfter(end)) {
      throw new BadRequestException('开始日期不能晚于结束日期');
    }

    const repo = await this.findRepo(input.repo_id ?? '');

    /** 开始日 00:00:00.000 到结束日 23:59:59.999，两端都计入 */
    const startAt = start.startOf('day').toDate();
    const endAt = end.endOf('day').toDate();
    const startDate = start.format(REPORT_DATE_FORMAT);
    const endDate = end.format(REPORT_DATE_FORMAT);
    const issues = (
      await this.issues.find({ where: { repoId: repo.id } })
    ).filter((item) => {
      return issueInRange(item, startAt, endAt);
    });
    const pullRequests = (
      await this.pullRequests.find({ where: { repoId: repo.id } })
    ).filter((item) => pullRequestInRange(item, startAt, endAt));
    const reportMarkdown = buildWeeklyMarkdown({
      repoName: repo.fullName,
      startDate,
      endDate,
      issues,
      pullRequests,
    });
    const title = `研发周报 ${startDate} - ${endDate}`.slice(0, 500);

    const saved = await this.documents.save(
      this.documents.create({
        repoId: repo.id,
        sourceType: WEEKLY_REPORT_SOURCE,
        sourceId: randomUUID(),
        title,
        content: reportMarkdown,
        meta: {
          display_title: title,
          start_date: startDate,
          end_date: endDate,
          repo_name: repo.fullName,
          generated_at: new Date().toISOString(),
          retrieval_mode: 'direct',
          rag_enabled: false,
        },
      }),
    );

    return toRecord(saved);
  }

  /**
   * 按主键取仓库。
   * 没传主键时 400，仓库不存在时 404。
   */
  private async findRepo(repoId: string): Promise<RepoEntity> {
    const id = repoId.trim();
    if (!id) throw new BadRequestException('请选择仓库');
    const repo = await this.repos.findOne({ where: { id } });
    if (!repo) throw new NotFoundException('未找到仓库');
    return repo;
  }
}

/**
 * 把文档行收成接口返回的周报。
 * 起止日期只读取元数据里的字符串，没有就不填。
 */
function toRecord(document: Document): WeeklyReportRecord {
  return {
    id: document.id,
    title: document.title,
    start_date: textOf(document.meta?.start_date),
    end_date: textOf(document.meta?.end_date),
    created_at: document.createdAt.toISOString(),
    report_markdown: document.content,
  };
}

/** 读取可选字符串。空白视为没有 */
function textOf(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}
