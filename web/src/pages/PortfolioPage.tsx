import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
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
import { portfolioApi } from '../api/client'
import { kindLabel, mw, mwh } from '../format'
import { ModeTag } from '../runs/ModeTag'
import { Recommendation } from '../runs/Recommendation'
import { RunComparison } from '../runs/RunComparison'
import { useCurrentRun } from '../runs/useCurrentRun'

export function PortfolioPage() {
  const { data, error } = useQuery({ queryKey: ['portfolio'], queryFn: portfolioApi.get })
  const { data: run } = useCurrentRun()

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
      <h1 className="page-title">Portfolio overview</h1>
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
            <TableHeader>Type</TableHeader>
            <TableHeader>Location</TableHeader>
            <TableHeader>Generation capacity</TableHeader>
            <TableHeader>Storage</TableHeader>
            <TableHeader>Action</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.sites.map((site) => (
            <TableRow key={site.code}>
              <TableCell>
                {site.name}
                <div className="stat-label">{site.code}</div>
              </TableCell>
              <TableCell>{kindLabel(site.kind)}</TableCell>
              <TableCell>{site.location}</TableCell>
              <TableCell>{site.generation_mw ? mw(site.generation_mw) : '—'}</TableCell>
              <TableCell>{site.battery_mwh ? mwh(site.battery_mwh) : '—'}</TableCell>
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
