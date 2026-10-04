import { useQuery } from '@tanstack/react-query'
import {
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
import { runApi, type RunState } from '../api/client'
import { actionLabel, inr, mw, netCost, simTime, statusOf } from '../format'

/** BOB against today's practice on the same simulated day, and BOB's latest actions. */
export function RunComparison({ run }: { run: RunState }) {
  const summary = useQuery({ queryKey: ['summary', run.id, run.block], queryFn: () => runApi.summary(run.id) })
  const actions = useQuery({ queryKey: ['actions', run.id, run.block], queryFn: () => runApi.actions(run.id) })
  if (!summary.data || !actions.data) return <SkeletonText paragraph lineCount={4} />

  const { bob, baseline, saving_inr } = summary.data
  const rows = [
    { label: 'Net cost', bob: netCost(bob.cost_inr), practice: netCost(baseline.cost_inr), better: saving_inr >= 0,
      note: `${inr(Math.abs(saving_inr))} ${saving_inr >= 0 ? 'saved' : 'more'}` },
    { label: 'Curtailment', bob: `${bob.curtailed_mwh.toFixed(1)} MWh`, practice: `${baseline.curtailed_mwh.toFixed(1)} MWh`,
      better: bob.curtailed_mwh <= baseline.curtailed_mwh, note: '' },
    { label: 'Deviation from schedule', bob: `${bob.deviation_mwh.toFixed(1)} MWh`,
      practice: `${baseline.deviation_mwh.toFixed(1)} MWh`, better: bob.deviation_mwh <= baseline.deviation_mwh, note: '' },
    { label: 'Carbon from imports', bob: `${bob.carbon_t.toFixed(1)} t`, practice: `${baseline.carbon_t.toFixed(1)} t`,
      better: bob.carbon_t <= baseline.carbon_t, note: '' },
  ]

  return (
    <>
      <h2 className="section-title">Today with BOB vs today's practice</h2>
      <div className="card-grid">
        {rows.map((r) => (
          <Tile key={r.label}>
            <div className="stat-label">{r.label}</div>
            <div className="stat-value">{r.bob}</div>
            <div className="stat-label">
              Today's practice: {r.practice} {r.note && <Tag size="sm" type={r.better ? 'green' : 'red'}>{r.note}</Tag>}
            </div>
          </Tile>
        ))}
      </div>

      <h2 className="section-title">Transaction history</h2>
      <Table aria-label="BOB's latest actions">
        <TableHead>
          <TableRow>
            <TableHeader>Block</TableHeader>
            <TableHeader>Action</TableHeader>
            <TableHeader>Site</TableHeader>
            <TableHeader>Commanded</TableHeader>
            <TableHeader>Delivered</TableHeader>
            <TableHeader>Initiated by</TableHeader>
            <TableHeader>Status</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {actions.data.map((a) => (
            <TableRow key={a.id}>
              <TableCell>{simTime(a.time)}</TableCell>
              <TableCell>
                {actionLabel(a.kind, a.mw)}
                {a.asset && <div className="stat-label">{a.asset}</div>}
              </TableCell>
              <TableCell>{a.site ?? 'Portfolio'}</TableCell>
              <TableCell>{mw(Math.abs(a.mw))}</TableCell>
              <TableCell>{a.delivered_mw === null ? '—' : mw(Math.abs(a.delivered_mw))}</TableCell>
              <TableCell>{a.decided_by ? `BOB, approved by ${a.decided_by}` : 'BOB'}</TableCell>
              <TableCell>
                <Tag size="sm" type={statusOf(a.status).tag} title={a.reason ?? undefined}>
                  {statusOf(a.status).label}
                </Tag>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  )
}
