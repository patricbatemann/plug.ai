import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { InlineNotification, SkeletonText } from '@carbon/react'
import {
  AiGenerate,
  ArrowDown,
  ArrowDownLeft,
  ArrowUp,
  ArrowUpRight,
  BatteryFull,
  BatteryLow,
  CheckmarkOutline,
  Chip,
  Industry,
  Search,
  SolarPanel,
  SortDescending,
  Sun,
  WindPower,
} from '@carbon/icons-react'
import { portfolioApi, type SiteStatus, type SiteSummary } from '../api/client'
import { batteryState, kindLabel, mw, mwh, sentence, simDateTime, siteBadge } from '../format'
import { modeText } from '../runs/ModeTag'
import { Recommendation } from '../runs/Recommendation'
import { RunComparison } from '../runs/RunComparison'
import { useCurrentRun, useSiteStatuses } from '../runs/useCurrentRun'

const TONE_ORDER = { red: 0, amber: 1, green: 2 }
const SITE_ICON: Record<string, typeof Sun> = { solar: SolarPanel, wind: WindPower, hybrid: Chip, industrial: Industry }

export function PortfolioPage() {
  const { data, error } = useQuery({ queryKey: ['portfolio'], queryFn: portfolioApi.get })
  const { data: run } = useCurrentRun()
  const live = useSiteStatuses(run)
  const now = Object.fromEntries((live.data ?? []).map((s) => [s.code, s]))

  if (error) return <InlineNotification kind="error" title="Could not load the portfolio" subtitle={error.message} hideCloseButton lowContrast />
  if (!data) return <SkeletonText paragraph lineCount={6} />

  const card = (title: string, kind: string, label: string, value: string, Icon: typeof Sun) => {
    const sites = data.sites.filter((s) => s.asset_kinds.includes(kind))
    const known = sites.filter((s) => now[s.code])
    const health = known.length ? Math.round((100 * known.filter((s) => siteBadge(now[s.code]).tone === 'green').length) / known.length) : null
    return { title, sites: sites.length, label, value, Icon, health }
  }
  const cards = [
    card('Solar portfolio', 'solar', 'Total capacity', mw(data.totals.solar_mw), Sun),
    card('Wind portfolio', 'wind', 'Total capacity', mw(data.totals.wind_mw), WindPower),
    card('Battery portfolio', 'bess', 'Total storage', `${mwh(data.totals.battery_mwh)} · ${mw(data.totals.battery_mw)}`, BatteryFull),
    card('Industrial demand', 'consumer', 'Connected load', mw(data.totals.demand_mw), Industry),
  ]

  return (
    <>
      <div className="band">
        <div>
          <div className="band__name">
            <span className="band__title">{data.name}</span>
            <span className="band__rule" />
            <span className="band__powered">Powered by PlugAI</span>
          </div>
          <p className="band__sub">Portfolio command center</p>
        </div>
        <div className="band__right">
          <div className="band__updated">
            <span className="caps-label">Last updated</span>
            <span className="band__clock">{run ? `${simDateTime(run.sim_time)} IST` : '—'}</span>
          </div>
          <span className="status-chip"><span className="dot dot--green" />BOB · {modeText(run, data.mode_code)}</span>
        </div>
      </div>

      <h1 className="page-title">Portfolio overview</h1>
      <div className="chip-row">
        {cards.map((c) => (
          <span key={c.title} className="chip">{c.title.split(' ')[0]} ({c.sites} {c.sites === 1 ? 'site' : 'sites'})</span>
        ))}
      </div>

      <div className="card-grid">
        {cards.map(({ title, sites, label, value, Icon, health }) => (
          <div key={title} className="panel portfolio-card">
            <div className="portfolio-card__head">
              <span className="portfolio-card__title"><Icon size={18} className="icon-accent" />{title}</span>
              <span className="chip">{sites} {sites === 1 ? 'site' : 'sites'}</span>
            </div>
            <div className="portfolio-card__stats">
              <div>
                <div className="caps-label">{label}</div>
                <div className="portfolio-card__value">{value}</div>
              </div>
              <div className="portfolio-card__health" title="Share of these sites operating normally now">
                <div className="caps-label">Portfolio health</div>
                <div className="portfolio-card__value text-success">{health === null ? '—' : `${health}%`}</div>
              </div>
            </div>
            <div className="meter"><div className="meter__fill" style={{ width: `${health ?? 0}%` }} /></div>
          </div>
        ))}
      </div>

      {run && run.block >= 0 && <Recommendation run={run} />}
      <SitesTable sites={data.sites} now={now} live={!!run?.live} />
      {run && run.block >= 0 && <RunComparison run={run} />}
    </>
  )
}

function SitesTable({ sites, now, live }: { sites: SiteSummary[]; now: Record<string, SiteStatus>; live: boolean }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('attention')

  const rows = sites
    .filter((s) => `${s.name} ${s.code} ${s.location} ${kindLabel(s.kind)}`.toLowerCase().includes(search.toLowerCase()))
    .filter((s) => filter === 'all' || !now[s.code] || (siteBadge(now[s.code]).tone === 'green') === (filter === 'normal'))
    .sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name)
      if (sort === 'output') return (now[b.code]?.output_mw ?? 0) - (now[a.code]?.output_mw ?? 0)
      const weight = (s: SiteSummary) => (now[s.code] ? TONE_ORDER[siteBadge(now[s.code]).tone] : 3)
      return weight(a) - weight(b)
    })

  return (
    <section className="panel sites">
      <div className="sites__head">
        <div className="sites__title">
          <h2>Registered sites</h2>
          <span className="chip">{rows.length} of {sites.length} sites</span>
        </div>
        <div className="sites__tools">
          <label className="field field--search">
            <Search size={14} />
            <input aria-label="Search sites" placeholder="Search sites" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <label className="field">
            <span>Status:</span>
            <select aria-label="Filter sites by status" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All statuses</option>
              <option value="attention">Needs attention</option>
              <option value="normal">Operating normally</option>
            </select>
          </label>
          <label className="field">
            <SortDescending size={14} />
            <span>Sort:</span>
            <select aria-label="Sort sites" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="attention">Attention first</option>
              <option value="name">Site name</option>
              <option value="output">Live output</option>
            </select>
          </label>
          <button type="button" className="text-link" onClick={() => { setSearch(''); setFilter('all') }}>View all</button>
        </div>
      </div>

      <div className="sites__scroll" role="region" aria-label="Registered sites table" tabIndex={0}>
        <div className="sites__row sites__row--head">
          <div>Site</div><div>Live output</div><div>Performance</div><div>Storage</div>
          <div>Grid position</div><div>Status</div><div>AI activity</div><div>Action</div>
        </div>
        {rows.map((site) => <SiteRow key={site.code} site={site} s={now[site.code]} live={live} />)}
      </div>
    </section>
  )
}

function SiteRow({ site, s, live }: { site: SiteSummary; s?: SiteStatus; live: boolean }) {
  const Icon = SITE_ICON[site.kind] ?? Chip
  const b = s && siteBadge(s)
  const diff = s?.output_mw != null && s.forecast_mw ? s.output_mw - s.forecast_mw : null
  const net = s?.net_mw ?? 0
  return (
    <div className={`sites__row${b && b.tone !== 'green' ? ' sites__row--attention' : ''}`}>
      <div className="sites__site">
        <span className="icon-box"><Icon size={18} className="icon-success" /></span>
        <div>
          <div className="sites__name">
            {site.name}
            {live && <span className="live-flag"><span className="dot dot--green" />Live</span>}
          </div>
          <div className="cell-sub">{site.location.split(',')[0]} · {kindLabel(site.kind)}</div>
        </div>
      </div>

      <div>
        {site.generation_mw ? (
          <>
            <div><strong>{s?.output_mw != null ? mw(s.output_mw) : '—'}</strong> <span className="cell-sub">active</span></div>
            <div className="meter meter--small">
              <div className="meter__fill" style={{ width: `${Math.min(100, (100 * (s?.output_mw ?? 0)) / site.generation_mw)}%` }} />
            </div>
            <div className="cell-sub">of {mw(site.generation_mw)} capacity</div>
          </>
        ) : <span className="cell-sub">No generation</span>}
      </div>

      <div>
        {diff === null ? <span className="cell-sub">Unavailable</span> : (
          <div className={Math.abs(diff) < 0.5 || diff > 0 ? 'text-success' : 'text-caution'}>
            <div className="cell-strong">{Math.round((100 * s!.output_mw!) / s!.forecast_mw!)}% of forecast</div>
            <div className="cell-trend">
              {Math.abs(diff) < 0.5 ? 'On forecast' : <>
                {diff > 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                {Math.round(Math.abs(diff))} MW {diff > 0 ? 'above' : 'below'} expected
              </>}
            </div>
          </div>
        )}
      </div>

      <div>
        {s?.storage_pct != null ? (
          <>
            <div className="cell-icon">
              {s.storage_pct < 30 ? <BatteryLow size={14} /> : <BatteryFull size={14} />}
              <span className="cell-strong">{s.storage_pct}%</span>
            </div>
            <div className="cell-sub">{batteryState(s.battery_mw ?? 0, s.status !== 'Battery unavailable')}</div>
          </>
        ) : <span className="cell-sub">{site.battery_mwh ? '—' : 'No battery'}</span>}
      </div>

      <div>
        {s && (
          <>
            <div className="cell-icon cell-medium">
              {net > 0.5 ? <ArrowUpRight size={14} /> : net < -0.5 ? <ArrowDownLeft size={14} /> : <CheckmarkOutline size={14} />}
              {net > 0.5 ? 'Exporting' : net < -0.5 ? 'Importing' : 'Balanced'}
            </div>
            <div className="cell-sub">{net > 0.5 ? `${mw(net)} sent` : net < -0.5 ? `${mw(-net)} drawn` : 'No net exchange'}</div>
          </>
        )}
      </div>

      <div>
        {b && (
          <span className={`badge badge--${b.tone}`}>
            <span className="dot" />{b.label}
            {b.count && <span className="badge__count">{b.count}</span>}
          </span>
        )}
      </div>

      <div className={`sites__ai${s?.bob_now.length ? ' sites__ai--active' : ''}`}>
        <AiGenerate size={14} />
        <span>
          {s ? (s.bob_now.length ? sentence(s.bob_now[0]) : 'Holding') : '—'}
          {s && s.bob_now.length > 1 && ` +${s.bob_now.length - 1} more`}
        </span>
      </div>

      <div><Link to={`/sites/${site.code}`} className="text-link">Open site</Link></div>
    </div>
  )
}
