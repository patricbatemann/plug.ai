import type { Asset } from './api/client'

export const PRODUCT_NAME = 'PlugAI'

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

export const MODES = ['balanced', 'economic', 'clean', 'resilience', 'grid_support']

export const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

export const modeLabel = (code: string) => sentence(code.replace(/_/g, ' '))

export function assetSummary({ kind, params: p }: Asset): string {
  const n = (key: string) => number.format(p[key] as number)
  switch (kind) {
    case 'bess':
      return `${n('energy_mwh')} MWh · SOC ${n('soc_min_pct')}–${n('soc_max_pct')} % · ${n('cycles_per_day')} cycles/day`
    case 'wind':
      return `Cut-in ${n('cut_in')} · rated ${n('rated')} · cut-out ${n('cut_out')} m/s`
    case 'solar':
      return p.curtail_comp_inr_mwh ? `Contracted · curtailment compensation ₹${n('curtail_comp_inr_mwh')}/MWh` : 'Owned'
    case 'consumer':
      return `Critical ${n('critical_mw')} MW · demand response up to ${n('dr_max_mw')} MW`
    case 'interconnection':
      return `Import ${n('import_max_mw')} MW · export ${n('export_max_mw')} MW`
    default:
      return ''
  }
}

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

/** Work orders to the maintenance system: no MW, no fallback plan. */
export const WORK_ORDERS = ['maintenance_schedule', 'inspection_dispatch']

export function actionLabel(kind: string, mw: number): string {
  if (kind === 'load_shift') return mw < 0 ? 'Load moved in' : 'Load moved out'
  return ACTION_LABELS[kind] ?? kind
}

/** A cost that is negative is money earned; say so instead of showing a minus sign. */
export const netCost = (value: number) => (value < 0 ? `${inr(-value)} earned` : `${inr(value)} cost`)

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
  return out
}
