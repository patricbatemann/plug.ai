export interface User {
  id: number
  email: string
}

export interface AuthResponse {
  access_token: string
  token_type: 'bearer'
  user: User
}

export interface SiteSummary {
  code: string
  name: string
  kind: string
  location: string
  generation_mw: number
  battery_mwh: number
  asset_kinds: string[]
}

export interface Portfolio {
  name: string
  tz: string
  mode_code: string
  protected: { battery_soc_floor_pct?: number; approval_above_mw?: number }
  totals: {
    solar_mw: number
    wind_mw: number
    battery_mw: number
    battery_mwh: number
    demand_mw: number
  }
  sites: SiteSummary[]
  nodes: NetworkItem[]
  lines: NetworkItem[]
  assets: Array<{ code: string; name: string; kind: string }>
}

export interface NetworkItem {
  code: string
  name: string
}

export interface Asset {
  code: string
  name: string
  kind: string
  capacity_mw: number
  params: Record<string, unknown>
  active: boolean
}

export interface SiteDetail {
  code: string
  name: string
  kind: string
  location: string
  commissioned_on: string
  mode_code: string
  assets: Asset[]
}

export interface Preset {
  code: string
  name: string
  description: string
}

export interface RunState {
  id: number
  preset: string
  name: string
  status: 'running' | 'paused' | 'done'
  speed: number
  sim_time: string
  block: number
  total_blocks: number
  live: boolean
  mode: string
  mode_by: string
  bob_online: boolean
  lagging: boolean
}

export interface Alert {
  severity: 'info' | 'warning' | 'error'
  title: string
  detail: string
}

export interface ChartPoint {
  group: string
  time: string
  value: number
  low: number | null
  high: number | null
}

export interface SiteLive {
  sim_time: string
  as_of: string
  block: number
  weather: {
    condition: string
    cloud_pct: number
    irradiance_wm2: number
    wind_ms: number
    temperature_c: number
    frequency_hz: number
  }
  generation: { actual_mw: number; forecast_mw: number | null; capacity_mw: number } | null
  batteries: Array<{ code: string; name: string; mw: number; soc_pct: number; energy_mwh: number; power_mw: number; available: boolean }>
  demand_mw: number | null
  grid_mw: number | null
  alerts: Alert[]
  bob_now: string[]
  chart: ChartPoint[]
  sources: Array<{ label: string; mw: number }>
  uses: Array<{ label: string; mw: number }>
}

export interface PolicyTotals {
  cost_inr: number
  market_inr: number
  dsm_inr: number
  dr_inr: number
  wear_inr: number
  curtail_inr: number
  curtailed_mwh: number
  carbon_t: number
  deviation_mwh: number
  unserved_mwh: number
}

export interface RunSummary {
  block: number
  bob: PolicyTotals
  baseline: PolicyTotals
  saving_inr: number
}

export interface ActionOut {
  id: number
  block: number
  time: string
  cycle_id: number | null
  tier: 'auto' | 'approval' | 'recommend' | 'prohibited'
  deadline_at: string | null
  decided_by: string | null
  kind: string
  site: string | null
  asset: string | null
  mw: number
  delivered_mw: number | null
  actual_mw: number | null
  status: string
  reason: string | null
}

export interface DecisionSummary {
  id: number
  time: string
  mode: string
  mode_by: string
  mode_reason: string
  chosen: string | null
  selected_by: 'bob' | 'rule'
  agent: string | null
  rationale: string
  holds: number
  tests: number
}

export interface DecisionDetail extends DecisionSummary {
  trigger: string
  trigger_detail: string
  floors: string[]
  situation: Array<{ code: string; label: string; value: string; threshold: string; material: boolean; mode: string }>
  scenarios: Record<string, string>
  options: Array<{
    variant: string
    label: string
    chosen: boolean
    actions: string[]
    cost_inr: number
    carbon_t: number
    curtailed_mwh: number
    deviation_mwh: number
    worst_regret_inr: number | null
    stress: Record<string, { regret_inr: number | null; holds: boolean; reserve_shortfall_mwh: number | null }>
  }>
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'ApiError'
  }
}

const TOKEN_KEY = 'bob.accessToken'

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')

async function send(path: string, init: RequestInit = {}): Promise<Response> {
  const token = tokenStore.get()
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  })

  if (!response.ok) {
    let message = `Request failed (${response.status})`
    try {
      const body: { detail?: string | Array<{ msg?: string }> } = await response.json()
      if (typeof body.detail === 'string') message = body.detail
      else if (Array.isArray(body.detail)) {
        message = body.detail.map((issue) => issue.msg).filter(Boolean).join('; ') || message
      }
    } catch {
      // Keep the status-based message when the response has no JSON body.
    }
    throw new ApiError(message, response.status)
  }
  return response
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await send(path, init)
  return (response.status === 204 ? undefined : response.json()) as Promise<T>
}

/** A file as the API takes it: its name and its content in base64. */
export const fileUpload = (file: File) => new Promise<{ filename: string; data: string }>((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve({ filename: file.name, data: String(reader.result).split(',')[1] })
  reader.onerror = () => reject(reader.error)
  reader.readAsDataURL(file)
})

export type ChatEvent =
  | { event: 'status'; data: string }
  | { event: 'delta'; data: string }
  | { event: 'done'; data: ChatItem[] }

/** Reads a server-sent event stream; EventSource cannot POST or send the token. */
async function stream(path: string, body: unknown, onEvent: (e: ChatEvent) => void): Promise<void> {
  const response = await send(path, { method: 'POST', body: JSON.stringify(body) })
  const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += value
    const frames = buffer.split('\n\n')
    buffer = frames.pop()!
    for (const frame of frames) {
      const event = /^event: (.*)$/m.exec(frame)?.[1]
      const data = /^data: (.*)$/m.exec(frame)?.[1]
      if (event && data) onEvent({ event, data: JSON.parse(data) } as ChatEvent)
    }
  }
}

export const authApi = {
  register: (email: string, password: string) =>
    request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  login: (email: string, password: string) =>
    request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<User>('/api/auth/me'),
}

export const portfolioApi = {
  get: () => request<Portfolio>('/api/portfolio'),
  setMode: (mode_code: string) =>
    request<Portfolio>('/api/portfolio', { method: 'PATCH', body: JSON.stringify({ mode_code }) }),
  site: (code: string) => request<SiteDetail>(`/api/sites/${encodeURIComponent(code)}`),
}

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) })

export const runApi = {
  presets: () => request<Preset[]>('/api/runs/presets'),
  current: () => request<RunState>('/api/runs/current'),
  create: (preset: string) => post<RunState>('/api/runs', { preset }),
  pause: (id: number) => post<RunState>(`/api/runs/${id}/pause`),
  play: (id: number) => post<RunState>(`/api/runs/${id}/play`),
  step: (id: number) => post<RunState>(`/api/runs/${id}/step`),
  speed: (id: number, speed: number) =>
    request<RunState>(`/api/runs/${id}`, { method: 'PATCH', body: JSON.stringify({ speed }) }),
  inject: (id: number, event: Record<string, unknown>) => post<RunState>(`/api/runs/${id}/events`, event),
  summary: (id: number) => request<RunSummary>(`/api/runs/${id}/summary`),
  actions: (id: number, filter: { limit?: number; status?: string[]; site?: string; block?: number } = {}) => {
    const query = new URLSearchParams({ limit: String(filter.limit ?? 20) })
    filter.status?.forEach((s) => query.append('status', s))
    if (filter.site) query.set('site', filter.site)
    if (filter.block !== undefined) query.set('block', String(filter.block))
    return request<ActionOut[]>(`/api/runs/${id}/actions?${query}`)
  },
  approve: (id: number, actionId: number) => post<RunState>(`/api/runs/${id}/actions/${actionId}/approve`),
  decline: (id: number, actionId: number) => post<RunState>(`/api/runs/${id}/actions/${actionId}/decline`),
  events: (id: number, after: number) =>
    request<Array<{ id: number; kind: string; sim_at: string; source: string; label: string }>>(
      `/api/runs/${id}/events?after=${after}`,
    ),
  latestDecision: (id: number) => request<DecisionSummary>(`/api/runs/${id}/decisions/latest`),
  decision: (cycleId: number) => request<DecisionDetail>(`/api/runs/decisions/${cycleId}`),
  chat: (id: number) => request<ChatItem[]>(`/api/runs/${id}/chat`),
  ask: (id: number, message: string, context: string | undefined, onEvent: (e: ChatEvent) => void) =>
    stream(`/api/runs/${id}/chat`, { message, context }, onEvent),
  sites: (id: number) => request<SiteStatus[]>(`/api/runs/${id}/sites`),
  siteLive: (id: number, code: string) =>
    request<SiteLive>(`/api/runs/${id}/sites/${encodeURIComponent(code)}/live`),
}

export type ChatCard =
  | { type: 'blocked'; asset_name: string; kind: string; text: string }
  | { type: 'draft'; config_id: number; site: string; asset: string; asset_name: string; kind: string; version: number
      autonomy: ConfigValues['autonomy']; limits: Record<string, number>; watch: ConfigValues['watch'] }
  | { type: 'tests'; config_id: number; site: string; asset: string; asset_name: string; kind: string
      tests: ConfigOut['tests'] }
  | { type: 'what_if'; changes: Record<string, unknown>; current: WhatIfPlan; what_if: WhatIfPlan }
  | { type: 'constraint'; id: number; kind: string; label: string; quote: string; note: string; verified: boolean
      confidence: number; filename: string | null; status: 'pending' | 'active' | 'rejected' | 'withdrawn' }

export interface WhatIfPlan {
  feasible: boolean
  net_cost_inr?: number
  carbon_t?: number
  curtailed_mwh?: number
  unserved_mwh?: number
  actions?: string[]
}

export interface ChatItem {
  id: number
  role: 'user' | 'assistant'
  text: string
  cards: ChatCard[]
}

export interface MaintenanceTask {
  id: number
  asset: string
  kind: string
  hours: number
  earliest_at: string
  deadline_at: string
  calendar_at: string
  scheduled_at: string
  safety_critical: boolean
  status: 'planned' | 'in progress' | 'done'
}

export const documentApi = {
  samples: () => request<Array<{ name: string; title: string }>>('/api/document-samples'),
  upload: (runId: number, doc: { sample: string } | { filename: string; data: string }) =>
    post<ChatItem[]>(`/api/runs/${runId}/documents`, doc),
  decide: (runId: number, id: number, decision: 'apply' | 'reject' | 'withdraw') =>
    post<ChatItem[]>(`/api/runs/${runId}/constraints/${id}/${decision}`),
  maintenance: (runId: number, site: string) =>
    request<{ tasks: MaintenanceTask[]; proposals: ActionOut[] }>(
      `/api/runs/${runId}/sites/${encodeURIComponent(site)}/maintenance`,
    ),
}

export interface WhatIfChange {
  assets_out: string[]
  demand_pct: number | null
  renewables_pct: number | null
  price_pct: number | null
  line_limits: Array<{ line: string; limit_mw: number }>
  mode: string | null
}

export interface Study {
  id: number
  preset: string
  created_at: string
  created_by: string
  metrics: Record<string, string>
  seeds: Array<{
    seed: number
    progress: number
    done: boolean
    bob: PolicyTotals | null
    baseline: PolicyTotals | null
    saving_inr: number | null
    violations: string[]
  }>
  reliability: {
    replays_done: number
    hard_limit_violations: number
    unserved_mwh: Record<'bob' | 'baseline', number>
    safe_holds: number
    approvals_expired: number
  }
}

export const simulationApi = {
  whatIf: (runId: number, change: WhatIfChange) =>
    post<{ current: WhatIfPlan; what_if: WhatIfPlan }>(`/api/runs/${runId}/what-if`, change),
  studies: () => request<Array<{ id: number; preset: string; seeds: number; created_at: string }>>('/api/studies'),
  study: (id: number) => request<Study>(`/api/studies/${id}`),
  createStudy: (preset: string, seeds: number) => post<Study>('/api/studies', { preset, seeds }),
  bobCalls: () =>
    request<{ calls: number; ok: number; by_purpose: Record<string, number>; failures: Record<string, number>
      median_ms: number | null }>('/api/bob-calls'),
}

export interface SiteStatus {
  code: string
  output_mw: number | null
  forecast_mw: number | null
  storage_pct: number | null
  battery_mw: number | null // + discharging, - charging
  net_mw: number // + sent to the network, - drawn from it
  status: 'Normal' | 'Below forecast' | 'Battery unavailable'
  bob_now: string[]
  pending: number
}

export interface ActivityEntry {
  at: string
  category: string
  title: string | null
  detail: string
  by: string | null
  kind: string | null
  mw: number | null
  status: string | null
  asset: string | null
}

export interface CsvCheck {
  rows: number
  columns: Array<{ name: string; type: string; known?: boolean }>
  preview: string[][]
  problems: string[]
}

export interface DataSource {
  id: number
  kind: 'csv' | 'api'
  name: string
  rows: number | null
  columns: Array<{ name: string; type: string }>
  refresh_min: number | null
  created_by: string
  created_at: string
}

const site = (code: string) => `/api/sites/${encodeURIComponent(code)}`

export const siteApi = {
  activity: (runId: number, code: string, categories: string[]) => {
    const query = new URLSearchParams()
    categories.forEach((c) => query.append('category', c))
    return request<ActivityEntry[]>(`/api/runs/${runId}/sites/${encodeURIComponent(code)}/activity?${query}`)
  },
  /** The run's telemetry for the site as CSV, saved by the browser (a link cannot carry the token). */
  downloadTelemetry: async (runId: number, code: string) => {
    const response = await send(`/api/runs/${runId}/sites/${encodeURIComponent(code)}/telemetry.csv`)
    const link = document.createElement('a')
    link.href = URL.createObjectURL(await response.blob())
    link.download = `${code.toLowerCase()}-telemetry.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  },
  sources: (code: string) => request<DataSource[]>(`${site(code)}/data-sources`),
  checkCsv: (code: string, file: { filename: string; data: string }) =>
    post<CsvCheck>(`${site(code)}/data-sources/csv/check`, file),
  importCsv: (code: string, file: { filename: string; data: string }) =>
    post<DataSource>(`${site(code)}/data-sources/csv`, file),
  testApi: (code: string, api: { endpoint: string; refresh_min: number }) =>
    post<CsvCheck>(`${site(code)}/data-sources/api/test`, api),
  connectApi: (code: string, api: { endpoint: string; refresh_min: number }) =>
    post<DataSource>(`${site(code)}/data-sources/api`, api),
  removeSource: (code: string, id: number) =>
    request<void>(`${site(code)}/data-sources/${id}`, { method: 'DELETE' }),
}

export interface ConfigValues {
  name: string
  autonomy: 'auto' | 'approval' | 'recommend'
  limits: Record<string, number>
  approval: { response_min?: number; approver?: string }
  watch: Array<{ metric: string; value: number }>
}

export interface ConfigOut extends ConfigValues {
  id: number
  asset: string
  asset_name: string
  kind: string
  status: 'draft' | 'testing' | 'active' | 'paused'
  version: number
  current: boolean
  tests: Record<string, { label: string; passed: boolean; detail: string }>
  actions_today: number
  active: ConfigValues | null
}

export interface ConfigOptions {
  assets: Array<{
    code: string
    name: string
    kind: string
    capacity_mw: number
    actions: string[]
    watch_metric: string | null
    watch_label: string | null
  }>
  protected: { battery_soc_floor_pct?: number; approval_above_mw?: number }
}

export const configApi = {
  list: (site: string) => request<ConfigOut[]>(`/api/sites/${site}/configs`),
  options: (site: string) => request<ConfigOptions>(`/api/sites/${site}/config-options`),
  save: (site: string, draft: ConfigValues & { asset: string; kind: string }) =>
    post<ConfigOut>(`/api/sites/${site}/configs`, draft),
  test: (id: number) => post<ConfigOut>(`/api/configs/${id}/test`),
  activate: (id: number) => post<ConfigOut>(`/api/configs/${id}/activate`),
  setStatus: (id: number, status: 'active' | 'paused') =>
    request<ConfigOut>(`/api/configs/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  watch: (runId: number, site: string) =>
    request<Array<{ asset: string; label: string; value: number | null; met: boolean }>>(
      `/api/runs/${runId}/sites/${site}/watch`,
    ),
}
