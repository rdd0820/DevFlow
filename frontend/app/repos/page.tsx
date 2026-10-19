'use client'

import { useEffect, useState } from 'react'
import { Eye, EyeOff, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { API_BASE_URL, apiDelete, apiGet, apiPost } from '@/lib/api'

/** 列表里的一条已连接仓库。响应不带 token */
type Repository = {
  /** 仓库主键，刷新、选中和删除都用它 */
  id: string
  /** owner/name，页面上显示的仓库名 */
  full_name: string
  /** 默认分支。远端没给时后端用 main */
  default_branch?: string | null
  /** 仓库描述。没有时页面显示「暂无仓库描述」 */
  description?: string | null
}

/** 一次同步里某个数据源的结果。键是 issues 或 pull_requests */
type RepoSyncSource = {
  /** skipped、completed、empty、partial、failed 之一。skipped 表示这次没选这个数据源 */
  status: string
  /** 这次看到或写入的条数。列表请求失败时为 0 */
  count: number
  /** 列表是否拿全。失败或因为条数上限截断时为 false */
  complete: boolean
  /** 列表请求翻过的页数。失败时保持进入失败前的值 */
  pages: number
}

/** 连接或立即刷新返回的同步摘要 */
type RepoSyncResult = {
  /** 被同步的仓库主键 */
  repo_id: string
  /** 总状态：completed、empty、partial、failed、skipped */
  status: string
  /** 两类数据实际写入的条数 */
  synced: {
    /** 本次写入的 Issue 条数 */
    issues: number
    /** 本次写入的 Pull Request 条数 */
    pull_requests: number
  }
  /** 给页面看的一句说明 */
  message: string
  /** 各数据源自己的状态，用来判断是失败还是被条数上限截断 */
  sources: Record<string, RepoSyncSource>
  /** 失败原因。子请求会带路径，例如 pull_requests/#1/files */
  errors: string[]
}

/** 连接接口的完整结果。同步明细在 sync_details 里 */
type RepoConnectResult = {
  /** 新建或更新后的仓库主键 */
  repo_id: string
  /** owner/name */
  full_name: string
  /** 默认分支 */
  default_branch?: string | null
  /** 这次连接是否已写入本地记录 */
  connected: boolean
  /** 连接和同步的结果说明 */
  message: string
  /** 同步总状态：completed、empty、partial、failed、skipped */
  sync_status?: string
  /** 同步明细 */
  sync_details?: RepoSyncResult | null
}

/** 页面上的一次操作结果。连接和刷新会带上同步摘要 */
type ActionNotice = {
  /** 结果标题，例如已连接、已刷新 */
  title: string
  /** 一句说明 */
  message: string
  /** 为 true 时用错误样式 */
  error?: boolean
  /** 同步明细。选择和删除没有这项 */
  sync?: RepoSyncResult | null
  /** 接口原始响应。切换到 JSON 时原样展示 */
  raw: unknown
}

/** 同步状态对应的中文说明 */
const SYNC_STATUS_TEXT: Record<string, string> = {
  completed: '已全部同步',
  empty: '没有记录',
  partial: '未同步完',
  failed: '同步失败',
  skipped: '这次未同步',
}

/** 只展示 Issue 和 Pull Request。旧响应里的其它数据源不显示 */
const SYNC_ROWS = [
  { key: 'issues', label: 'Issue', countKey: 'issues' },
  { key: 'pull_requests', label: 'Pull Request', countKey: 'pull_requests' },
] as const

/**
 * 把一次同步结果收成两行可读说明。
 * 条数取实际写入数，状态取该数据源自己的结果。
 */
function syncLines(sync: RepoSyncResult): string[] {
  return SYNC_ROWS.map((row) => {
    const source = sync.sources[row.key]
    const count = sync.synced[row.countKey]
    const status = SYNC_STATUS_TEXT[source?.status] || '状态未知'
    return `${row.label}：${count} 条，${status}`
  })
}

/** 仓库连接、同步、设为当前查看和删除 */
export default function ReposPage() {
  const [repos, setRepos] = useState<Repository[]>([])
  const [selectedRepoId, setSelectedRepoId] = useState('')
  const [owner, setOwner] = useState('')
  const [repo, setRepo] = useState('')
  const [token, setToken] = useState('')
  const [tokenVisible, setTokenVisible] = useState(false)
  const [result, setResult] = useState<ActionNotice | null>(null)
  /** 为 true 时结果区显示接口 JSON，否则显示摘要。默认摘要 */
  const [showJson, setShowJson] = useState(false)
  const [loading, setLoading] = useState(false)

  /** 重新拉取列表。传入 id 时保持该仓库为当前选中 */
  async function refreshRepos(nextSelectedId?: string) {
    const items = await apiGet<Repository[]>('/api/repos')
    setRepos(items)
    setSelectedRepoId(nextSelectedId || selectedRepoId || items[0]?.id || '')
  }

  useEffect(() => {
    refreshRepos().catch(() => setRepos([]))
  }, [])

  /** 全量刷新一个仓库，并把它留在当前选中 */
  async function syncRepo(repoId: string) {
    const data = await apiPost<RepoSyncResult>(`/api/repos/${repoId}/sync`, {
      sync_issues: true,
      sync_pull_requests: true,
      limit: null,
    })
    setSelectedRepoId(repoId)
    await refreshRepos(repoId)
    return data
  }

  /** 按当前表单连接 GitHub 仓库 */
  async function connect() {
    setLoading(true)
    try {
      const connected = await apiPost<RepoConnectResult>('/api/repos/connect', {
        owner: owner.trim(),
        repo: repo.trim(),
        token: token || undefined,
      })
      setResult({
        title: '仓库已连接',
        message: connected.message,
        sync: connected.sync_details,
        raw: connected,
      })
      await refreshRepos(connected.repo_id)
    } catch (error) {
      setResult({
        title: '连接失败',
        message: error instanceof Error ? error.message : String(error),
        error: true,
        raw: { error: error instanceof Error ? error.message : String(error) },
      })
    } finally {
      setLoading(false)
    }
  }

  /** 立即刷新选中仓库的 Issue 和 PR */
  async function refreshRepo(repoId: string) {
    setLoading(true)
    try {
      const synced = await syncRepo(repoId)
      setResult({ title: '刷新完成', message: synced.message, sync: synced, raw: { refreshed: synced } })
    } catch (error) {
      setResult({
        title: '刷新失败',
        message: error instanceof Error ? error.message : String(error),
        error: true,
        raw: { error: error instanceof Error ? error.message : String(error) },
      })
    } finally {
      setLoading(false)
    }
  }

  /** 设为当前查看。成功后列表按更新时间把该仓库排到前面 */
  async function selectRepo(repoId: string) {
    setSelectedRepoId(repoId)
    const data = await apiPost<{ full_name: string }>(`/api/repos/${repoId}/select`, {})
    setResult({ title: '已设为当前查看', message: data.full_name, raw: data })
    await refreshRepos(repoId)
  }

  /** 删除本地同步数据。远程 Git 仓库不会被删除 */
  async function deleteRepo(item: Repository) {
    const confirmed = window.confirm(`确认删除仓库 ${item.full_name} 及其本地同步的 Issues、PR、分析结果吗？此操作只删除本系统本地数据，不会删除远程 Git 仓库。`)
    if (!confirmed) return
    setLoading(true)
    try {
      const data = await apiDelete(`/api/repos/${item.id}`)
      setResult({
        title: '已删除本地记录',
        message: `${item.full_name} 的同步数据已删除，远程仓库还在。`,
        raw: data,
      })
      await refreshRepos()
    } catch (error) {
      setResult({
        title: '删除失败',
        message: error instanceof Error ? error.message : String(error),
        error: true,
        raw: { error: error instanceof Error ? error.message : String(error) },
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">仓库接入</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          连接真实 Git 仓库后会立即同步；环境可配置 Webhook 实时触发，并通过定时同步兜底。
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="owner">Owner / Namespace</Label>
                <Input
                  id="owner"
                  name="github-owner"
                  autoComplete="off"
                  value={owner}
                  placeholder="octocat"
                  onChange={(event) => setOwner(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="repo">Repository</Label>
                <Input
                  id="repo"
                  name="github-repository"
                  autoComplete="off"
                  value={repo}
                  placeholder="Hello-World"
                  onChange={(event) => setRepo(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="token">Access Token</Label>
                <div className="relative">
                  {/* 不用 password。浏览器会把密码框和前面的文本框当成登录框，自动填入已保存的账号密码。隐藏时用圆点样式遮住内容 */}
                  <Input
                    id="token"
                    name="github-access-token"
                    type="text"
                    autoComplete="off"
                    spellCheck={false}
                    className={tokenVisible ? 'pr-9' : 'pr-9 [-webkit-text-security:disc]'}
                    value={token}
                    placeholder="public repo 可留空，私有仓库需要 token"
                    onChange={(event) => setToken(event.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="absolute top-1/2 right-0.5 -translate-y-1/2 text-muted-foreground active:-translate-y-1/2!"
                    aria-label={tokenVisible ? '隐藏 Access Token' : '显示 Access Token'}
                    aria-pressed={tokenVisible}
                    onClick={() => setTokenVisible((visible) => !visible)}
                  >
                    {tokenVisible ? <EyeOff /> : <Eye />}
                  </Button>
                </div>
              </div>
            </div>

            <div>
              <Button
                disabled={loading || !owner.trim() || !repo.trim()}
                onClick={() => connect()}
              >
                {loading ? '连接并同步中...' : '连接并自动同步'}
              </Button>
            </div>

            {result && (
              <div className={`rounded-lg border p-4 text-sm ${result.error ? 'border-destructive/40 bg-destructive/5' : 'bg-muted/40'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className={`font-medium ${result.error ? 'text-destructive' : ''}`}>{result.title}</div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowJson((visible) => !visible)}
                  >
                    {showJson ? '查看摘要' : '查看 JSON'}
                  </Button>
                </div>
                {showJson ? (
                  <pre className="mt-3 overflow-auto rounded-lg bg-zinc-950 p-4 text-xs text-zinc-100">{JSON.stringify(result.raw, null, 2)}</pre>
                ) : (
                  <>
                    <p className="mt-1 text-muted-foreground">{result.message}</p>
                    {result.sync && (
                      <ul className="mt-3 flex flex-col gap-1">
                        {syncLines(result.sync).map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    )}
                    {result.sync && result.sync.errors.length > 0 && (
                      <ul className="mt-3 flex flex-col gap-1 text-destructive">
                        {result.sync.errors.map((error) => (
                          <li key={error}>{error}</li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>已连接仓库</CardTitle>
            <CardDescription>{repos.length} 个</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {repos.length === 0 && <p className="text-sm text-muted-foreground">还没有仓库。请连接一个真实 Git 仓库。</p>}
            {repos.map((item) => (
              <div
                key={item.id}
                className={`rounded-lg border p-4 ${selectedRepoId === item.id ? 'border-primary/40 bg-muted/50' : 'border-border'}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{item.full_name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {item.default_branch || 'main'}
                    </div>
                  </div>
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                    {selectedRepoId === item.id ? '当前查看' : '已连接'}
                  </span>
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{item.description || '暂无仓库描述'}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => selectRepo(item.id)}>
                    设为当前查看
                  </Button>
                  <Button size="sm" disabled={loading} onClick={() => refreshRepo(item.id)}>
                    立即刷新
                  </Button>
                  <Button size="sm" variant="destructive" disabled={loading} onClick={() => deleteRepo(item)}>
                    <Trash2 />
                    删除
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>同步策略</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
          <div className="rounded-lg bg-muted/60 p-3">
            <div className="font-medium text-foreground">连接后自动同步</div>
            <p className="mt-1">仓库校验成功后，后端会立即同步一次。</p>
          </div>
          <div className="rounded-lg bg-muted/60 p-3">
            <div className="font-medium text-foreground">Webhook 实时触发</div>
            <p className="mt-1 break-all">GitHub Webhook URL：{API_BASE_URL}/api/webhooks/github</p>
          </div>
          <div className="rounded-lg bg-muted/60 p-3">
            <div className="font-medium text-foreground">定时同步兜底</div>
            <p className="mt-1">后端启动后会定时刷新已连接仓库，默认 5 分钟一次。</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
