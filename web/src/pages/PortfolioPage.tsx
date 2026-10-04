import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Button,
  InlineNotification,
  SkeletonText,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
  Tile,
} from '@carbon/react'
import { portfolioApi, runApi } from '../api/client'
import { kindLabel, mw, mwh } from '../format'
import { ModeTag } from '../runs/ModeTag'
import { Recommendation } from '../runs/Recommendation'
import { RunComparison } from '../runs/RunComparison'
import { useCurrentRun } from '../runs/useCurrentRun'

export function PortfolioPage() {
  const { data, error } = useQuery({ queryKey: ['portfolio'], queryFn: portfolioApi.get })
  const { data: run } = useCurrentRun()
  const live = useQuery({
    queryKey: ['sites-status', run?.id, run?.block],
    queryFn: () => runApi.sites(run!.id),
    enabled: !!run && run.block >= 0,
  })
  const now = Object.fromEntries((live.data ?? []).map((s) => [s.code, s]))

  if (error) return <InlineNotification kind="error" title="Could not load the portfolio" subtitle={error.message} hideCloseButton lowContrast />
  if (!data) return <SkeletonText paragraph lineCount={6} />

  const sitesWith = (kind: string) => data.sites.filter((s) => s.asset_kinds.includes(kind)).length
  const cards = [
    { title: 'Solar portfolio', sites: sitesWith('solar'), label: 'Total capacity', value: mw(data.totals.solar_mw) },
    { title: 'Wind portfolio', sites: sitesWith('wind'), label: 'Total capacity', value: mw(data.totals.wind_mw) },
    {
      title: 'Battery portfolio',
      sites: sitesWith('bess'),
      label: 'Total storage',
      value: `${mwh(data.totals.battery_mwh)} · ${mw(data.totals.battery_mw)}`,
    },
    { title: 'Industrial demand', sites: sitesWith('consumer'), label: 'Connected load', value: mw(data.totals.demand_mw) },
  ]

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Portfolio overview</h1>
        <Button kind="ghost" as={Link} to="/simulation">Run simulation</Button>
      </div>
      <p className="page-meta">{data.name}</p>
      <div className="tag-row">
        <ModeTag defaultMode={data.mode_code} />
      </div>

      <div className="card-grid">
        {cards.map((card) => (
          <Tile key={card.title}>
            <div className="card-title">
              {card.title} <Tag size="sm">{card.sites} {card.sites === 1 ? 'site' : 'sites'}</Tag>
            </div>
            <div className="stat-label">{card.label}</div>
            <div className="stat-value">{card.value}</div>
          </Tile>
        ))}
      </div>

      {run && run.block >= 0 && <Recommendation run={run} />}

      <Table aria-label="Registered sites">
        <TableHead>
          <TableRow>
            <TableHeader>Site</TableHeader>
            <TableHeader>Output now</TableHeader>
            <TableHeader>Storage</TableHeader>
            <TableHeader>Status</TableHeader>
            <TableHeader>What BOB is doing</TableHeader>
            <TableHeader />
          </TableRow>
        </TableHead>
        <TableBody>
          {data.sites.map((site) => (
            <TableRow key={site.code}>
              <TableCell>
                {site.name}
                <div className="stat-label">{kindLabel(site.kind)} · {site.location}</div>
              </TableCell>
              <TableCell>
                {now[site.code]?.output_mw != null ? mw(now[site.code].output_mw!) : site.generation_mw ? '—' : 'No generation'}
                {site.generation_mw > 0 && (
                  <div className="stat-label">
                    {now[site.code]?.forecast_mw != null ? `forecast ${mw(now[site.code].forecast_mw!)} · ` : ''}
                    capacity {mw(site.generation_mw)}
                  </div>
                )}
              </TableCell>
              <TableCell>
                {site.battery_mwh ? mwh(site.battery_mwh) : '—'}
                {now[site.code]?.storage_pct != null && <div className="stat-label">{now[site.code].storage_pct} % charged</div>}
              </TableCell>
              <TableCell>
                {now[site.code] && (
                  <Tag size="sm" type={now[site.code].status === 'Normal' ? 'green' : 'warm-gray'}>{now[site.code].status}</Tag>
                )}
              </TableCell>
              <TableCell>
                {now[site.code] && (now[site.code].bob_now.length ? now[site.code].bob_now.join('; ') : 'Holding')}
                {now[site.code]?.pending > 0 && (
                  <div><Tag size="sm" type="warm-gray">{now[site.code].pending} awaiting approval</Tag></div>
                )}
              </TableCell>
              <TableCell>
                <Link to={`/sites/${site.code}`} className="cds--link">Open site</Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {run && run.block >= 0 && <RunComparison run={run} />}
    </>
  )
}
