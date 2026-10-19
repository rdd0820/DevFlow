/**
 * 周报用到的一条 Issue。
 * 时间字段用来判断是否落在所选区间，标题和状态写进正文。
 */
export type ReportIssue = {
  /** Issue 编号 */
  number: number;
  /** 标题 */
  title: string;
  /** open 或 closed */
  state: string;
  /** 远端创建时间。为空时不参与区间判断 */
  createdAt: Date | null;
  /** 远端更新时间。为空时不参与区间判断 */
  updatedAt: Date | null;
  /** 关闭时间。为空表示未关闭，也不参与区间判断 */
  closedAt: Date | null;
};

/**
 * 周报用到的一条 Pull Request。
 * 合并时间同时用于区间判断和「本周完成」。
 */
export type ReportPullRequest = {
  /** PR 编号 */
  number: number;
  /** 标题 */
  title: string;
  /** open 或 closed。是否合并看 mergedAt，不看这个字段 */
  state: string;
  /** 远端创建时间。为空时不参与区间判断 */
  createdAt: Date | null;
  /** 远端更新时间。为空时不参与区间判断 */
  updatedAt: Date | null;
  /** 合并时间。为空表示未合并 */
  mergedAt: Date | null;
};

/** 生成周报所需的仓库和已经按区间筛过的记录 */
export type WeeklyReportInput = {
  /** owner/name，写在标题上 */
  repoName: string;
  /** 开始日期，YYYY-MM-DD，按 UTC 日历日 */
  startDate: string;
  /** 结束日期，YYYY-MM-DD，按 UTC 日历日，含当天 */
  endDate: string;
  /** 区间内的 Issue */
  issues: ReportIssue[];
  /** 区间内的 Pull Request */
  pullRequests: ReportPullRequest[];
};

/**
 * 判断一个时间是否落在闭区间内。
 * 空时间视为不在区间内。
 */
export function inRange(
  value: Date | null,
  startAt: Date,
  endAt: Date,
): boolean {
  if (!value) return false;
  const time = value.getTime();
  return time >= startAt.getTime() && time <= endAt.getTime();
}

/**
 * Issue 只要创建、更新、关闭里有一个时间落在区间内，就计入周报。
 */
export function issueInRange(
  issue: ReportIssue,
  startAt: Date,
  endAt: Date,
): boolean {
  return [issue.createdAt, issue.updatedAt, issue.closedAt].some((value) => {
    return inRange(value, startAt, endAt);
  });
}

/**
 * Pull Request 只要创建、更新、合并里有一个时间落在区间内，就计入周报。
 */
export function pullRequestInRange(
  pullRequest: ReportPullRequest,
  startAt: Date,
  endAt: Date,
): boolean {
  return [
    pullRequest.createdAt,
    pullRequest.updatedAt,
    pullRequest.mergedAt,
  ].some((value) => inRange(value, startAt, endAt));
}

/**
 * 把编号收成「#1, #2」。
 * 最多取前 limit 个；一个都没有时返回「暂无」。
 */
function numbers(items: Array<{ number: number }>, limit: number): string {
  const text = items
    .slice(0, limit)
    .map((item) => `#${item.number}`)
    .join(', ');
  return text || '暂无';
}

/**
 * 把若干条记录收成 Markdown 列表。
 * 没有记录时返回空字符串，调用方自己决定要不要补一句说明。
 */
function lines(items: string[]): string {
  return items.join('\n');
}

/**
 * 根据已筛选的 Issue 和 Pull Request 生成周报 Markdown。
 * 不调用大模型。
 * 区间外的记录必须在调用前去掉，这里不再过滤。
 */
export function buildWeeklyMarkdown(input: WeeklyReportInput): string {
  const issues = input.issues;
  const pullRequests = input.pullRequests;
  const merged = pullRequests.filter((item) => item.mergedAt);
  const openPullRequests = pullRequests.filter((item) => item.state === 'open');
  const closedIssues = issues.filter((item) => item.state === 'closed');
  const openLines = lines(
    openPullRequests
      .slice(0, 5)
      .map((item) => `- #${item.number} ${item.title}`),
  );
  const watched = lines(
    pullRequests.slice(0, 5).map((item) => `- #${item.number} ${item.title}`),
  );
  const inProgress = openPullRequests.length
    ? `${openLines}\n`
    : '- 暂无 Open PR。\n';

  return (
    `# ${input.repoName} 研发周报\n\n` +
    `> 时间范围：${input.startDate} 至 ${input.endDate}\n\n` +
    `## 数据概览\n` +
    `- Issues：${issues.length} 个\n` +
    `- PRs：${pullRequests.length} 个，其中 Merged PR ${merged.length} 个，Open PR ${openPullRequests.length} 个\n\n` +
    `## 本周完成\n` +
    `- 合并 PR ${merged.length} 个：${numbers(merged, 8)}。\n` +
    `- 关闭 Issue ${closedIssues.length} 个：${numbers(closedIssues, 8)}。\n\n` +
    `## 进行中\n` +
    `- 当前仍有 ${openPullRequests.length} 个 Open PR 需要跟进。\n` +
    inProgress +
    `\n` +
    `## 需要关注的 PR\n` +
    watched
  );
}
//  +
// `\n\n## 下周建议\n` +
// `- 补充关键模块测试覆盖。\n- 对高风险 PR 提前拆分 Review。\n`
