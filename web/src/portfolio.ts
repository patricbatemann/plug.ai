import { useQuery } from '@tanstack/react-query'
import { portfolioApi, runApi, type ActionOut, type Portfolio, type RunSummary, type SiteStatus, type SiteSummary } from './api/client'
import { actionLabel, batteryState, inr, kindLabel, mw, mwh, siteBadge, simDateTime, statusOf } from './format'
import { useCurrentRun, useSiteStatuses } from './runs/useCurrentRun'

export type Tone = 'amber' | 'green' | 'blue' | 'red' | 'gray'

export interface SiteRow {
  id: string
  name: string
  type: string
  location: string
  isLive: boolean
  liveOutputMw: number
  capacityMw: number
  performance?: { percentOfForecast: number; isBelow: boolean; deviationText: string }
  storage: { soc: number | null; statusText: string }
  grid: { status: 'Importing' | 'Exporting' | 'Balanced' | 'Disconnected'; loadText: string }
  status: { label: string; badgeCount?: number; tone: Tone }
  aiActivity: { text: string; isPulsing: boolean }
}

export interface Category {
  id: string
  icon: string
  title: string
  sitesCount: number
  capacity: string
  live: string
  fill: string
}

export interface Stat {
  label: string
  value: string
  note: string
  icon: string
}

export interface Transaction {
  id: string
  date: string
  site: string
  type: string
  typeIcon: string
  initiator: string
  initIsBot: boolean
  initInitials: string
  amount: string
  tier: string
  status: string
  statusTone: Tone
  reason: string
}

/** The portfolio dashboard, from the portfolio and the live run; refreshed with each block. */
export function usePortfolio() {
  const run = useCurrentRun().data
  const portfolio = useQuery({ queryKey: ['portfolio'], queryFn: portfolioApi.get }).data
  const statuses = useSiteStatuses(run).data ?? []
  const summary = useQuery({
    queryKey: ['summary', run?.id, run?.block],
    queryFn: () => runApi.summary(run!.id),
    enabled: !!run,
  }).data
  const actions = useTransactions()
  const byCode = new Map(statuses.map((s) => [s.code, s]))
  return {
    simTime: run ? `${simDateTime(run.sim_time)} IST` : '',
    categories: portfolio ? categories(portfolio, statuses) : [],
    stats: summary ? stats(summary) : [],
    sites: (portfolio?.sites ?? []).map((site) => siteRow(site, byCode.get(site.code))),
    transactions: actions,
  }
}

export function useTransactions(): Transaction[] {
  const run = useCurrentRun().data
  const actions = useQuery({
    queryKey: ['actions', run?.id, run?.block],
    queryFn: () => runApi.actions(run!.id, { limit: 50 }),
    enabled: !!run,
  }).data
  return (actions ?? []).map(transaction)
}

function categories({ sites, totals }: Portfolio, statuses: SiteStatus[]): Category[] {
  const of = (members: SiteSummary[]) => statuses.filter((s) => members.some((m) => m.code === s.code))
  const card = (id: string, members: SiteSummary[], capacity: string, live: string, percent: number): Category => ({
    id, icon: id, title: `${id[0].toUpperCase()}${id.slice(1)} Portfolio`, sitesCount: members.length, capacity, live,
    fill: `${Math.min(100, Math.round(percent))}%`,
  })
  const generating = (id: string, members: SiteSummary[], capacity: number) => {
    const output = of(members).reduce((sum, s) => sum + (s.output_mw ?? 0), 0)
    return card(id, members, mw(capacity), `${mw(output)} now`, capacity ? (output / capacity) * 100 : 0)
  }
  const battery = sites.filter((s) => s.battery_mwh > 0)
  const charged = of(battery).filter((s) => s.storage_pct !== null)
  const soc = charged.length ? charged.reduce((sum, s) => sum + s.storage_pct!, 0) / charged.length : 0
  return [
    generating('solar', sites.filter((s) => s.kind === 'solar' || s.kind === 'hybrid'), totals.solar_mw),
    generating('wind', sites.filter((s) => s.kind === 'wind'), totals.wind_mw),
    card('battery', battery, mwh(totals.battery_mwh), `${Math.round(soc)} % charged`, soc),
  ]
}

function stats({ actions, by_people, saving_inr }: RunSummary): Stat[] {
  return [
    { label: 'Total transactions', value: String(actions), note: 'this run', icon: 'activity' },
    { label: 'BOB runs', value: String(actions - by_people), note: 'decided by BOB', icon: 'cpu' },
    { label: 'User made', value: String(by_people), note: 'approved or declined by a person', icon: 'user' },
    saving_inr >= 0
      ? { label: 'Saving', value: inr(saving_inr), note: 'vs today’s practice', icon: 'trending-up' }
      : { label: 'Extra cost', value: inr(-saving_inr), note: 'more than today’s practice', icon: 'trending-up' },
  ]
}

function siteRow(site: SiteSummary, s: SiteStatus | undefined): SiteRow {
  const output = s?.output_mw ?? 0
  const badge = s ? siteBadge(s) : { label: 'No data yet', tone: 'gray' as const, count: undefined }
  const net = s?.net_mw ?? 0
  return {
    id: site.code,
    name: site.name,
    type: kindLabel(site.kind),
    location: site.location,
    isLive: !!s,
    liveOutputMw: output,
    capacityMw: site.generation_mw,
    performance: s?.forecast_mw
      ? {
          percentOfForecast: Math.round((output / s.forecast_mw) * 100),
          isBelow: output < s.forecast_mw,
          deviationText: `${mw(Math.abs(output - s.forecast_mw))} ${output < s.forecast_mw ? 'below' : 'above'} forecast`,
        }
      : undefined,
    storage: {
      soc: s?.storage_pct ?? null,
      statusText: s?.battery_mw == null ? 'No battery' : batteryState(s.battery_mw, s.status !== 'Battery unavailable'),
    },
    grid: {
      status: !s ? 'Disconnected' : net > 0.05 ? 'Exporting' : net < -0.05 ? 'Importing' : 'Balanced',
      loadText: s ? `${mw(Math.abs(net))} ${net >= 0 ? 'to' : 'from'} the network` : '',
    },
    status: { label: badge.label, badgeCount: badge.count, tone: badge.tone },
    aiActivity: { text: s?.bob_now[0] ?? 'Monitoring', isPulsing: !!s?.bob_now.length },
  }
}

const TYPE_ICONS: Record<string, string> = {
  rtm_sell: '/assets/157e5.svg',
  rtm_buy: '/assets/c3b94.svg',
  bess_charge: '/assets/b9f5b.svg',
  bess_discharge: '/assets/4cd99.svg',
}

const TIERS = { auto: 'Automatic', approval: 'Approval', recommend: 'Recommended', prohibited: 'Prohibited' }

const TONES: Record<string, Tone> = { green: 'green', blue: 'blue', red: 'red', 'warm-gray': 'amber' }

function transaction(a: ActionOut): Transaction {
  const person = a.decided_by
  const status = statusOf(a.status)
  return {
    id: String(a.id),
    date: simDateTime(a.time),
    site: a.site ?? 'Portfolio',
    type: actionLabel(a.kind, a.mw),
    typeIcon: TYPE_ICONS[a.kind] ?? '/assets/8b368.svg',
    initiator: person ?? 'BOB Agent',
    initIsBot: !person,
    initInitials: person ? person.slice(0, 2).toUpperCase() : '',
    amount: mwh(Math.abs(a.delivered_mw ?? a.mw) * 0.25),
    tier: TIERS[a.tier],
    status: status.label,
    statusTone: TONES[status.tag] ?? 'gray',
    reason: a.reason ?? '',
  }
}
