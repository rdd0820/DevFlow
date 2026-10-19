"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { format } from "date-fns"
import { zhCN } from "date-fns/locale"
import { CalendarIcon, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { apiDelete, apiGet, apiPost } from "@/lib/api"

/** 下拉框里的一条已连接仓库。只需要主键和显示名 */
type Repository = {
  /** 仓库主键，生成周报时提交 */
  id: string
  /** owner/name */
  full_name: string
}

/**
 * 一份已保存的周报。
 * 列表和生成接口返回同一形状，点开时直接用其中的正文。
 */
type WeeklyReportRecord = {
  /** 文档主键，选中和删除都用它 */
  id: string
  /** 展示标题，含起止日期 */
  title: string
  /** 统计开始日。没有这项时不显示时间范围 */
  start_date: string | null
  /** 统计结束日。没有这项时不显示时间范围 */
  end_date: string | null
  /** 写入时间，ISO 字符串 */
  created_at: string
  /** 完整 Markdown 正文 */
  report_markdown: string
}

/** 开始或结束日期选择器的入参。值始终是提交给接口的 YYYY-MM-DD */
type ReportDatePickerProps = {
  /** 按钮 id，对应旁边标签的 htmlFor */
  id: string
  /** 当前选中的本地日历日。空字符串时按钮显示占位文案 */
  value: string
  /** 用户点选某一天后回传同一格式，供周报请求使用 */
  onChange: (value: string) => void
}

/**
 * 把本地日期收成 YYYY-MM-DD。
 * 用本地日历日，避免凌晨时 UTC 日期比页面上的「今天」少一天。
 */
function toDateInput(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${date.getFullYear()}-${month}-${day}`
}

/**
 * 把 YYYY-MM-DD 还原成本地零点。
 * 格式不对或日期不存在时返回空，日历不预选任何一天。
 */
function parseDateInput(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return undefined
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return undefined
  }
  return date
}

/**
 * 弹出层里的单日日历。
 * 选中后收起，并把本地日历日交给外部。再次点已选日期不会清空。
 */
function ReportDatePicker({ id, value, onChange }: ReportDatePickerProps) {
  /** 弹出层是否打开。选中日期后主动关掉 */
  const [open, setOpen] = useState(false)
  /** 日历当前高亮的那天。value 无法解析时不预选 */
  const selected = parseDateInput(value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        id={id}
        render={
          <Button
            variant="outline"
            data-empty={!selected}
            className="w-full justify-start font-normal data-[empty=true]:text-muted-foreground"
          />
        }
      >
        <CalendarIcon />
        {selected ? format(selected, "PPP", { locale: zhCN }) : <span>选择日期</span>}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          required
          locale={zhCN}
          selected={selected}
          onSelect={(date) => {
            onChange(toDateInput(date))
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

/** 选择仓库和时间范围，生成这一段的研发周报 */
export default function ReportsPage() {
  const today = useMemo(() => new Date(), [])
  const weekStart = useMemo(() => {
    const date = new Date(today)
    date.setDate(date.getDate() - 6)
    return date
  }, [today])

  const [repos, setRepos] = useState<Repository[]>([])
  const [repoId, setRepoId] = useState("")
  const [startDate, setStartDate] = useState(toDateInput(weekStart))
  const [endDate, setEndDate] = useState(toDateInput(today))
  const [reports, setReports] = useState<WeeklyReportRecord[]>([])
  const [selectedReportId, setSelectedReportId] = useState("")
  const [report, setReport] = useState("")
  const [error, setError] = useState("")
  const [reportsError, setReportsError] = useState("")
  const [loading, setLoading] = useState(false)
  /** 正在等待确认删除的周报。为空时确认框关闭 */
  const [pendingDelete, setPendingDelete] = useState<WeeklyReportRecord | null>(null)
  /** 确认框里的删除失败说明。关闭确认框时清掉 */
  const [deleteError, setDeleteError] = useState("")
  const [deletingId, setDeletingId] = useState("")
  const [reposError, setReposError] = useState("")
  /** 当前选中的仓库。生成请求返回时用来判断用户是否已经换了仓库 */
  const repoIdRef = useRef(repoId)
  repoIdRef.current = repoId

  useEffect(() => {
    apiGet<Repository[]>("/api/repos")
      .then((items) => {
        setRepos(items)
        setRepoId(items[0]?.id || "")
      })
      .catch((reason: unknown) => {
        setRepos([])
        setReposError(reason instanceof Error ? reason.message : "仓库列表加载失败")
      })
  }, [])

  /** 切换仓库时重新拉取该仓库的周报，并清掉上一份正在看的正文 */
  useEffect(() => {
    if (!repoId) {
      setReports([])
      setSelectedReportId("")
      setReport("")
      setReportsError("")
      return
    }
    let cancelled = false
    setReports([])
    setReportsError("")
    setSelectedReportId("")
    setReport("")
    apiGet<WeeklyReportRecord[]>(`/api/reports?repo_id=${encodeURIComponent(repoId)}`)
      .then((items) => {
        if (cancelled) return
        setReports((current) => {
          const extra = current.filter((item) => !items.some((loaded) => loaded.id === item.id))
          return [...extra, ...items]
        })
      })
      .catch((reason: unknown) => {
        if (cancelled) return
        setReports([])
        setReportsError(reason instanceof Error ? reason.message : "周报列表加载失败")
      })
    return () => {
      cancelled = true
    }
  }, [repoId])

  /**
   * 在右侧打开一份已保存的周报。
   * 正文来自列表数据，不再额外请求。
   */
  function openReport(item: WeeklyReportRecord) {
    setSelectedReportId(item.id)
    setReport(item.report_markdown)
    setError("")
  }

  /**
   * 按当前仓库和日期请求周报。
   * 没有仓库时不发请求。开始日期晚于结束日期时只提示，不请求接口。
   * 两个值都是 YYYY-MM-DD，字符串比较与日历先后一致。
   * 成功后把新周报插到列表最前并打开。用户已经换了仓库时不再改当前列表。
   */
  async function generateReport() {
    if (!repoId) return
    if (startDate > endDate) {
      setReport("")
      setError("开始时间不能大于结束时间")
      return
    }
    setLoading(true)
    setError("")
    try {
      const data = await apiPost<WeeklyReportRecord>("/api/reports/weekly", {
        repo_id: repoId,
        start_date: startDate,
        end_date: endDate,
      })
      if (repoIdRef.current !== repoId) return
      setReports((items) => [data, ...items.filter((item) => item.id !== data.id)])
      setSelectedReportId(data.id)
      setReport(data.report_markdown)
    } catch (reason) {
      setReport("")
      setError(reason instanceof Error ? reason.message : "周报生成失败")
    } finally {
      setLoading(false)
    }
  }

  /**
   * 打开删除确认框。
   * 正在删除时不再打开另一份，避免两份请求叠在一起。
   */
  function askDelete(item: WeeklyReportRecord) {
    if (deletingId) return
    setDeleteError("")
    setPendingDelete(item)
  }

  /**
   * 删除确认框里当前选中的周报。
   * 没有待删对象或正在删除时不发请求。成功后关闭确认框；删掉当前打开的那份后清空右侧正文。
   */
  async function confirmDelete() {
    const item = pendingDelete
    if (!item || deletingId) return
    setDeletingId(item.id)
    setDeleteError("")
    try {
      await apiDelete(`/api/reports/${item.id}`)
      setReports((items) => items.filter((entry) => entry.id !== item.id))
      if (selectedReportId === item.id) {
        setSelectedReportId("")
        setReport("")
      }
      setPendingDelete(null)
    } catch (reason) {
      setDeleteError(reason instanceof Error ? reason.message : "周报删除失败")
    } finally {
      setDeletingId("")
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto lg:overflow-hidden">
      <div className="shrink-0">
        <h1 className="text-xl font-semibold">研发周报生成</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          按时间范围统计 Issues、PRs、Merged PRs 和 Open PRs，生成适合发给团队负责人的 Markdown 周报。
        </p>
      </div>

      <div className="grid gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[360px_1fr]">
        <div className="flex flex-col gap-4 lg:min-h-0">
          <Card>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="repo">仓库</Label>
                <select
                  id="repo"
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
                  value={repoId}
                  disabled={!repos.length}
                  onChange={(event) => setRepoId(event.target.value)}
                >
                  {repos.length ? (
                    repos.map((repo) => (
                      <option key={repo.id} value={repo.id}>
                        {repo.full_name}
                      </option>
                    ))
                  ) : (
                    <option value="">还没有连接仓库</option>
                  )}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="start-date">开始日期</Label>
                <ReportDatePicker id="start-date" value={startDate} onChange={setStartDate} />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="end-date">结束日期</Label>
                <ReportDatePicker id="end-date" value={endDate} onChange={setEndDate} />
              </div>

              {reposError ? <p className="text-sm text-destructive">{reposError}</p> : null}

              <Button disabled={!repoId || loading} onClick={() => void generateReport()}>
                {loading ? "生成中..." : "生成周报"}
              </Button>
            </CardContent>
          </Card>

          <Card className="lg:min-h-0 lg:flex-1">
            <CardHeader>
              <CardTitle>已生成周报</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 lg:min-h-0 lg:flex-1 lg:overflow-auto">
              {reportsError ? <p className="text-sm text-destructive">{reportsError}</p> : null}
              {reports.length === 0 && !reportsError ? (
                <p className="text-sm text-muted-foreground">这个仓库还没有周报。</p>
              ) : null}
              {reports.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-1 rounded-lg border px-2 py-1 ${selectedReportId === item.id ? "border-primary/40 bg-muted/50" : "border-border hover:bg-muted/40"}`}
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate px-1 py-1.5 text-left text-sm font-medium"
                    onClick={() => openReport(item)}
                  >
                    {item.title}
                  </button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`删除${item.title}`}
                    disabled={deletingId === item.id}
                    onClick={() => askDelete(item)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="lg:min-h-0">
          <CardHeader>
            <CardTitle>Markdown 周报</CardTitle>
          </CardHeader>
          <CardContent className="lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
            {error ? (
              <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive lg:flex-1">
                {error}
              </p>
            ) : report ? (
              <pre className="overflow-auto rounded-lg border bg-slate-950 p-4 text-sm leading-7 whitespace-pre-wrap text-slate-100 lg:min-h-0 lg:flex-1">
                {report}
              </pre>
            ) : (
              <p className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground lg:flex-1">
                从左侧选择一份周报，或生成一份新的。
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (open || deletingId) return
          setPendingDelete(null)
          setDeleteError("")
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除周报</DialogTitle>
            <DialogDescription>
              {`确认删除周报「${pendingDelete?.title ?? ""}」吗？删除后不能恢复。`}
            </DialogDescription>
          </DialogHeader>
          {deleteError ? <p className="text-sm text-destructive">{deleteError}</p> : null}
          <DialogFooter>
            <Button variant="outline" disabled={Boolean(deletingId)} onClick={() => setPendingDelete(null)}>
              取消
            </Button>
            <Button variant="destructive" disabled={Boolean(deletingId)} onClick={() => void confirmDelete()}>
              {deletingId ? "删除中..." : "删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
