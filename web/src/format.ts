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

export const modeLabel = (code: string) => {
  const words = code.replace(/_/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

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
