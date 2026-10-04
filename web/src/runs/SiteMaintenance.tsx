import { useQuery } from '@tanstack/react-query'
import {
  SkeletonText, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tag,
} from '@carbon/react'
import { documentApi, type RunState } from '../api/client'
import { actionLabel, simTime, statusOf } from '../format'
import { ActionCard } from './ActionCard'

const STATUS_TAG = { planned: 'gray', 'in progress': 'blue', done: 'green' } as const

/** Maintenance jobs at a site, with BOB's proposals to move them and to send inspections. */
export function SiteMaintenance({ run, site }: { run: RunState; site: string }) {
  const { data } = useQuery({
    queryKey: ['maintenance', run.id, site, run.block],
    queryFn: () => documentApi.maintenance(run.id, site),
  })
  if (!data) return <SkeletonText paragraph lineCount={4} />
  const open = data.proposals.filter((a) => a.status === 'awaiting_approval')
  const decided = data.proposals.filter((a) => a.status !== 'awaiting_approval')

  return (
    <div className="live">
      <h2 className="section-title">Jobs ({data.tasks.length})</h2>
      {data.tasks.length === 0 ? (
        <p className="page-meta">No maintenance planned at this site.</p>
      ) : (
        <Table aria-label="Maintenance jobs" size="md">
          <TableHead>
            <TableRow>
              {['Asset', 'Job', 'Calendared', 'BOB schedules', 'Must fit', 'Status'].map((h) => (
                <TableHeader key={h}>{h}</TableHeader>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {data.tasks.map((t) => (
              <TableRow key={t.id}>
                <TableCell>{t.asset}</TableCell>
                <TableCell>
                  {t.kind}, {t.hours} h{t.safety_critical && <Tag size="sm" type="red">Safety-critical</Tag>}
                </TableCell>
                <TableCell>{simTime(t.calendar_at)}</TableCell>
                <TableCell>
                  {t.scheduled_at === t.calendar_at ? simTime(t.scheduled_at) : <strong>{simTime(t.scheduled_at)} (moved)</strong>}
                </TableCell>
                <TableCell>{simTime(t.earliest_at)}–{simTime(t.deadline_at)}</TableCell>
                <TableCell><Tag size="sm" type={STATUS_TAG[t.status]}>{t.status}</Tag></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <p className="stat-label">Today&apos;s practice keeps the calendared time; BOB&apos;s schedule changes only when you approve a move.</p>
      <h2 className="section-title">BOB&apos;s proposals ({open.length})</h2>
      {open.length === 0 && <p className="page-meta">No proposals waiting.</p>}
      {open.map((a) => <ActionCard key={a.id} action={a} run={run} />)}
      {decided.length > 0 && (
        <>
          <h2 className="section-title">Earlier proposals</h2>
          {decided.map((a) => (
            <div key={a.id} className="action-card__head">
              <Tag size="sm" type={statusOf(a.status).tag}>{statusOf(a.status).label}</Tag>
              <span>{simTime(a.time)} · {actionLabel(a.kind, 0)} · {a.asset}: {a.reason}</span>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
