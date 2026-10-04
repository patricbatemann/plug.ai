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
  time: string
  kind: string
  site: string | null
  asset: string | null
  mw: number
  delivered_mw: number | null
  actual_mw: number | null
  status: string
  reason: string | null
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

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
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
  return response.json() as Promise<T>
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
  actions: (id: number, limit = 20) => request<ActionOut[]>(`/api/runs/${id}/actions?limit=${limit}`),
  siteLive: (id: number, code: string) =>
    request<SiteLive>(`/api/runs/${id}/sites/${encodeURIComponent(code)}/live`),
}
