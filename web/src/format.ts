import type { ConfigValues, DataSource, Preferences, SiteStatus } from './api/client'

const number = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 })

// `|| 0` turns -0 into 0 so idle flows never read "-0 MW".
export const mw = (value: number) => `${number.format(value || 0)} MW`
export const mwh = (value: number) => `${number.format(value || 0)} MWh`

const KIND_LABELS: Record<string, string> = {
  solar: 'Solar',
  wind: 'Wind',
  hybrid: 'Hybrid',
  industrial: 'Industrial',
  bess: 'Battery',
  consumer: 'Industrial load',
  interconnection: 'Grid interconnection',
}

export const kindLabel = (kind: string) => KIND_LABELS[kind] ?? kind

const clock = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

export const simTime = (iso: string) => clock.format(new Date(iso))

const day = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' })
export const simDateTime = (iso: string) => `${day.format(new Date(iso))}, ${simTime(iso)}`

const rupees = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
export const inr = (value: number) => rupees.format(value || 0)

const ACTION_LABELS: Record<string, string> = {
  bess_charge: 'Battery charge',
  bess_discharge: 'Battery discharge',
  rtm_buy: 'Market buy',
  rtm_sell: 'Market sell',
  curtail: 'Output limit',
  dr_call: 'Demand response call',
  maintenance_schedule: 'Move a maintenance job',
  inspection_dispatch: 'Send an inspection crew',
}

/** An action's status in words, with its tag colour. */
export const STATUS = {
  acked: { label: 'Executing', tag: 'blue' },
  verified: { label: 'Done', tag: 'green' },
  awaiting_approval: { label: 'Awaiting approval', tag: 'warm-gray' },
  recommended: { label: 'Recommended', tag: 'cool-gray' },
  declined: { label: 'Declined', tag: 'gray' },
  expired: { label: 'Expired unanswered', tag: 'gray' },
  rejected: { label: 'Blocked by a safety check', tag: 'red' },
  superseded: { label: 'Replaced', tag: 'gray' },
} as const
export const statusOf = (status: string) =>
  STATUS[status as keyof typeof STATUS] ?? { label: status, tag: 'gray' as const }

export function actionLabel(kind: string, mw: number): string {
  if (kind === 'load_shift') return mw < 0 ? 'Load moved in' : 'Load moved out'
  return ACTION_LABELS[kind] ?? kind
}

export function batteryState(mw: number, available: boolean): string {
  if (!available) return 'Unavailable'
  if (mw > 0.05) return `Discharging at ${mw.toFixed(1)} MW`
  if (mw < -0.05) return `Charging at ${(-mw).toFixed(1)} MW`
  return 'Idle'
}

const CONFIG_KINDS: Record<string, string> = {
  battery_charge: 'Charge battery',
  battery_discharge: 'Discharge battery',
  curtail: 'Limit plant output',
  demand_response: 'Call demand response',
  load_shift: 'Move industrial load',
  grid_import: 'Buy in the real-time market',
  grid_export: 'Sell in the real-time market',
}
export const configKindLabel = (kind: string) => CONFIG_KINDS[kind] ?? kind

export const AUTONOMY: Record<string, { label: string; detail: string }> = {
  recommend: { label: 'Recommend only', detail: 'BOB identifies the situation and suggests an action; a person starts it.' },
  approval: { label: 'Approval required', detail: 'BOB prepares the action and waits for an authorised person.' },
  auto: { label: 'Automatic within limits', detail: 'BOB acts when its plan calls for it and every limit is met.' },
}

export function limitsSummary(limits: Record<string, number>): string[] {
  const out = []
  if (limits.auto_max_mw !== undefined) out.push(`Automatic up to ${limits.auto_max_mw} MW, approval above`)
  if (limits.max_mw !== undefined) out.push(`Never more than ${limits.max_mw} MW`)
  if (limits.reserve_pct !== undefined) out.push(`Keeps ${limits.reserve_pct} % charge in reserve`)
  if (limits.min_price_inr_mwh) out.push(`Sells only above ₹${limits.min_price_inr_mwh}/MWh`)
  if (limits.max_minutes !== undefined)
    out.push(`Discharges for at most ${limits.max_minutes} min${limits.max_mwh !== undefined ? ` and ${limits.max_mwh} MWh` : ''} at a time`)
  if (limits.deficit_mw !== undefined)
    out.push(`Discharges only while portfolio load exceeds renewables by more than ${limits.deficit_mw} MW${limits.deficit_minutes ? ` for ${limits.deficit_minutes} min` : ''}`)
  return out
}

const WATCH: Record<string, (value: number) => string> = {
  soc_below_pct: (v) => `charge falls below ${v} %`,
  output_below_forecast_mw: (v) => `output falls more than ${v} MW below forecast`,
  demand_above_mw: (v) => `demand rises above ${v} MW`,
}

/** A watch condition in words, naming the watched asset (the action's own asset when none is named). */
export const watchLabel = (w: ConfigValues['watch'][number], owner: string, names: Record<string, string> = {}) =>
  `${w.asset ? names[w.asset] ?? w.asset : owner} ${WATCH[w.metric](w.value)}`

/** A site's state in one badge: approvals first, then trouble, then normal. */
export function siteBadge(s: SiteStatus): { label: string; tone: 'green' | 'amber' | 'red'; count?: number } {
  if (s.pending) return { label: 'Pending approval', tone: 'amber', count: s.pending }
  if (s.status === 'Battery unavailable') return { label: 'Battery unavailable', tone: 'red' }
  if (s.status === 'Below forecast') return { label: 'Below forecast', tone: 'amber' }
  return { label: 'Operating normally', tone: 'green' }
}

export const OBJECTIVES: Record<Preferences['objective'], string> = {
  reliability: 'Maintain supply reliability',
  cost: 'Reduce grid purchase cost',
  peak: 'Avoid peak grid demand',
  renewable: 'Maximize renewable energy use',
}

export const RECOVERY: Record<Preferences['recovery'], string> = {
  notify_and_hold: 'Notify and hold current state',
  request_import: 'Request grid import approval',
}

export const NOTIFY: Record<Preferences['notify'][number], string> = {
  sms: 'SMS — Operations team',
  email: 'Email — Site managers',
  push: 'Push — Plug.ai mobile app',
  slack: 'Slack — operations channel',
}

export const SOURCE_KIND: Record<DataSource['kind'], string> = {
  api: 'Telemetry API',
  forecast: 'Forecast API',
  prices: 'Market price API',
  csv: 'CSV',
}
