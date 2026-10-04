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
