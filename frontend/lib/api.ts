/** 后端根地址。开发时后端监听本机 3010 端口 */
export const API_BASE_URL = 'http://localhost:3010'

/** 浏览器连不上后端时抛出的说明，页面可以直接显示这句话 */
const NETWORK_ERROR_MESSAGE = '无法访问后端 API，请确认后端服务已经启动。'

/**
 * 发起请求，并把网络失败收成统一的中文错误。
 * HTTP 状态错误不在这里处理，交给调用方读取响应正文。
 */
async function request(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(`${API_BASE_URL}${path}`, init)
  } catch {
    throw new Error(NETWORK_ERROR_MESSAGE)
  }
}

/**
 * 读取失败响应里的说明。
 * 优先使用 detail，其次使用 message；两者都是数组时拼成一句。找不到就退回状态码。
 */
function readApiErrorMessage(payload: unknown): string | null {
  if (typeof payload === 'string') return payload
  if (!payload || typeof payload !== 'object') return null
  const record = payload as { detail?: unknown; message?: unknown }
  const detail = readErrorField(record.detail)
  if (detail) return detail
  return readErrorField(record.message)
}

/**
 * 把 detail 或 message 收成一句可读文本。
 * 字符串直接返回；校验错误数组取出 msg 或字符串元素。
 */
function readErrorField(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value
  if (!Array.isArray(value)) return null
  const messages = value
    .map((item) => {
      if (typeof item === 'string') return item
      if (item && typeof item === 'object' && 'msg' in item) return String(item.msg)
      return null
    })
    .filter((item): item is string => Boolean(item))
  return messages.length ? messages.join('; ') : null
}

/**
 * 把非 2xx 响应变成 Error。
 * JSON 正文走 detail/message 解析，其它正文用原文，都没有时用状态码。
 */
async function throwApiError(response: Response): Promise<never> {
  const fallback = `${response.status} ${response.statusText}`.trim()
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    let message: string | null = null
    try {
      message = readApiErrorMessage(await response.json())
    } catch {
      message = null
    }
    throw new Error(message || fallback)
  }
  const text = (await response.text()).trim()
  throw new Error(text || fallback)
}

/** GET JSON。缓存关闭，避免列表页拿到上一次的仓库或会话 */
export async function apiGet<T>(path: string): Promise<T> {
  const response = await request(path, { cache: 'no-store' })
  if (!response.ok) await throwApiError(response)
  return response.json() as Promise<T>
}

/** POST JSON */
export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) await throwApiError(response)
  return response.json() as Promise<T>
}

/** PATCH JSON */
export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const response = await request(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) await throwApiError(response)
  return response.json() as Promise<T>
}

/** DELETE，并解析 JSON 响应 */
export async function apiDelete<T>(path: string): Promise<T> {
  const response = await request(path, { method: 'DELETE' })
  if (!response.ok) await throwApiError(response)
  return response.json() as Promise<T>
}

/**
 * 上传表单。
 * 不手动设置 Content-Type，让浏览器带上 multipart 边界。
 */
export async function apiUpload<T>(path: string, body: FormData): Promise<T> {
  const response = await request(path, { method: 'POST', body })
  if (!response.ok) await throwApiError(response)
  return response.json() as Promise<T>
}
