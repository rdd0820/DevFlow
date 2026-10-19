/**
 * 顶栏里的一个模块入口。
 * href 既是页面路由，也用来判断当前高亮项；description 只出现在对应页面的占位说明里。
 */
export type NavItem = {
  /** 页面路径，Dashboard 固定为根路径 */
  href: string
  /** 顶栏上显示的名称 */
  label: string
  /** 这个模块后续要承载的能力，占位页用它向使用者说明位置 */
  description: string
}

/**
 * 顶栏模块顺序。
 * 根路径只匹配自身；其余项在子路径下也保持高亮，方便详情页沿用所属模块。
 */
export const navItems: NavItem[] = [
  {
    href: "/",
    label: "Dashboard",
    description: "选择仓库和会话，查看 Issue、PR、CI，并在这里和助手对话。",
  },
  {
    href: "/knowledge",
    label: "项目知识",
    description: "按仓库查看知识库、文档数量和索引状态，并进入单个知识库。",
  },
  {
    href: "/rag",
    label: "RAG 工作室",
    description: "上传资料、调整检索设置，并用知识库回答问题、核对引用来源。",
  },
  {
    href: "/repos",
    label: "Repos",
    description: "连接 GitHub 仓库，查看同步范围，并手动刷新或移除仓库。",
  },
  {
    href: "/action-drafts",
    label: "Drafts",
    description: "查看待确认的操作草稿，确认后才会真正执行，也可以取消。",
  },
  {
    href: "/workflow-runs",
    label: "Runs",
    description: "查看多步骤协作任务的目标、各步骤结果和最终结论。",
  },
  // {
  //   href: "/workspaces",
  //   label: "团队工作区",
  //   description: "把多个仓库组成工作区，并按时间范围生成跨仓库的研发周报。",
  // },
  {
    href: "/reports",
    label: "研发周报",
    description: "选择仓库和时间范围，生成这一段时间内的研发周报。",
  },
  // {
  //   href: "/code-graph",
  //   label: "Code Graph",
  //   description: "按符号、调用和引用关系查看仓库代码，也可以对照某个 PR 的快照。",
  // },
  {
    href: "/evals",
    label: "Evals",
    description: "运行固定评测，查看每题证据、指标和历史对比。",
  },
]

/**
 * 判断顶栏项是否对应当前路径。
 * 根路径不能用前缀匹配，否则所有页面都会把它当成当前项。
 */
export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}
