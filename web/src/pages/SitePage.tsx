import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, InlineNotification, OverflowMenu, OverflowMenuItem, SkeletonText } from '@carbon/react'
import { OverflowMenuHorizontal } from '@carbon/icons-react'
import { portfolioApi, siteApi, type SiteDetail } from '../api/client'
import { assetSummary, kindLabel, mw, simDateTime, siteBadge } from '../format'
import { LiveOverview } from '../runs/LiveOverview'
import { modeText } from '../runs/ModeTag'
import { SiteActions } from '../runs/SiteActions'
import { SiteActivity } from '../runs/SiteActivity'
import { SiteMaintenance } from '../runs/SiteMaintenance'
import { useCurrentRun, useSiteStatuses } from '../runs/useCurrentRun'

const TABS = ['Site details', 'Live overview', 'AI Actions', 'Maintenance', 'Activity log']

export function SitePage() {
  const { code = '' } = useParams()
  const { data, error } = useQuery({ queryKey: ['site', code], queryFn: () => portfolioApi.site(code) })
  const { data: run } = useCurrentRun()
  const status = useSiteStatuses(run).data?.find((s) => s.code === code)
  const [chosen, setTab] = useState<number | null>(null)
  const navigate = useNavigate()

  if (error) return <InlineNotification kind="error" title="Could not load the site" subtitle={error.message} hideCloseButton lowContrast />
  if (!data) return <SkeletonText paragraph lineCount={6} />

  const tab = run ? chosen ?? 1 : 0
  const generation = data.assets
    .filter((a) => a.kind === 'solar' || a.kind === 'wind')
    .reduce((sum, a) => sum + a.capacity_mw, 0)
  const badge = status && siteBadge(status)

  return (
    <>
      <div className="site-head">
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link to="/portfolio">Sites</Link><span>/</span><span>{data.name}</span><span>/</span><span>{TABS[tab]}</span>
        </nav>
        <div className="site-head__top">
          <div className="site-head__title">
            <span className={`site-head__mark site-head__mark--${badge?.tone ?? 'green'}`}><span className="dot" /></span>
            <h1>{data.name} · {data.code}</h1>
          </div>
          <div className="site-head__actions">
            <span className={`chip ${run?.bob_online ? 'chip--purple' : ''}`}>
              <span className="dot" />{run?.bob_online ? 'BOB online' : 'Rules only'}
            </span>
            <span className="chip chip--green">Data: simulated</span>
            <span className="chip">Mode: {modeText(run, data.mode_code)}</span>
            <Button className="btn-tall" onClick={() => navigate(`/sites/${data.code}/bob`)}>Configure BOB</Button>
            <OverflowMenu aria-label="More site actions" className="button-outline site-head__more" flipped renderIcon={OverflowMenuHorizontal}>
              <OverflowMenuItem itemText="Run simulation" onClick={() => navigate('/simulation')} />
              <OverflowMenuItem itemText="Connect data source" onClick={() => navigate(`/sites/${data.code}/data`)} />
            </OverflowMenu>
          </div>
        </div>
        <div className="chip-row chip-row--tight">
          {badge && <span className={`badge badge--${badge.tone}`}>{badge.label}</span>}
          <span className="chip">{kindLabel(data.kind)}</span>
          {generation > 0 && (
            <span className="chip">{mw(generation)}{status?.storage_pct != null && ` · ${status.storage_pct}% SOC`}</span>
          )}
        </div>
        <p className="site-head__meta">
          {data.location} · Commissioned {data.commissioned_on.slice(0, 4)}
          {run && ` · Simulated time ${simDateTime(run.sim_time)} IST`}
        </p>
        <div className="tabs" role="tablist" aria-label="Site sections">
          {TABS.map((label, i) => (
            <button key={label} type="button" role="tab" aria-selected={tab === i} disabled={i > 0 && !run} onClick={() => setTab(i)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div role="tabpanel" aria-label={TABS[tab]}>
        {tab === 0 && <SiteDetails site={data} />}
        {run && tab === 1 && (
          <LiveOverview run={run} siteCode={data.code}
            generationSeries={data.assets.some((a) => a.kind === 'solar') ? 'solar' : 'wind'} />
        )}
        {run && tab === 2 && <SiteActions run={run} site={data.code} />}
        {run && tab === 3 && <SiteMaintenance run={run} site={data.code} />}
        {run && tab === 4 && <SiteActivity run={run} site={data.code} />}
      </div>
    </>
  )
}

function SiteDetails({ site }: { site: SiteDetail }) {
  const capacity = site.assets.filter((a) => a.kind === 'solar' || a.kind === 'wind').reduce((sum, a) => sum + a.capacity_mw, 0)
  const rows = [
    ['Site name', site.name],
    ['Site ID', site.code],
    ['Site type', kindLabel(site.kind)],
    ['Capacity', `${mw(capacity)} · ${site.assets.length} connected assets`],
    ['Location', site.location],
    ['Commissioning date', new Date(site.commissioned_on).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })],
  ]
  return (
    <div className="stack">
      <section className="panel panel--padded">
        <h2 className="panel__title">Site details</h2>
        <dl className="kv">
          {rows.map(([label, value]) => (
            <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
          ))}
        </dl>
      </section>

      <section className="panel panel--padded">
        <div className="panel__head">
          <h2 className="panel__title">Assets <span className="chip chip--round">{site.assets.length} assets</span></h2>
        </div>
        <div className="table-scroll">
          <table className="ftable">
            <thead><tr><th>Asset name</th><th>Type</th><th>Capacity</th><th>Details</th></tr></thead>
            <tbody>
              {site.assets.map((a) => (
                <tr key={a.code}>
                  <td><strong>{a.name}</strong><div className="cell-sub">{a.code}</div></td>
                  <td>{kindLabel(a.kind)}</td>
                  <td>{mw(a.capacity_mw)}</td>
                  <td>{assetSummary(a)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <DataSources site={site.code} />
    </div>
  )
}

/** The site's connected data: simulated telemetry, plus any imports and APIs (a mock). */
function DataSources({ site }: { site: string }) {
  const queryClient = useQueryClient()
  const { data } = useQuery({ queryKey: ['sources', site], queryFn: () => siteApi.sources(site) })
  const remove = useMutation({
    mutationFn: (id: number) => siteApi.removeSource(site, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sources', site] }),
  })
  return (
    <section className="panel panel--padded">
      <div className="panel__head">
        <h2 className="panel__title">Data access</h2>
        <Button kind="tertiary" className="btn-tall" as={Link} to={`/sites/${site}/data`}>Connect data source</Button>
      </div>
      <ul className="checklist">
        <li><span className="dot dot--green" />Simulated telemetry, every 15 minutes: what BOB plans on</li>
        {data?.map((s) => (
          <li key={s.id}>
            <span className="dot dot--green" />
            <span>
              {s.name} · {s.kind === 'csv' ? 'imported CSV' : `API, every ${s.refresh_min} min`}
              {s.rows !== null && ` · ${s.rows} rows`} · {s.columns.length} columns · by {s.created_by}
            </span>
            <button type="button" className="text-link" onClick={() => remove.mutate(s.id)}>Remove</button>
          </li>
        ))}
      </ul>
      <p className="callout callout--info">Connecting a data source gives BOB more to read; it never grants BOB control of an asset.</p>
    </section>
  )
}
