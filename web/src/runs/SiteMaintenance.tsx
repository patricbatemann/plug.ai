import { useQuery } from '@tanstack/react-query'
import { SkeletonText } from '@carbon/react'
import { documentApi, type RunState } from '../api/client'
import { actionLabel, simTime } from '../format'
import { ActionCard } from './ActionCard'
import { StatusBadge } from './StatusBadge'

const STATUS_TONE = { planned: 'gray', 'in progress': 'blue', done: 'green' } as const

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
    <div className="stack">
      <div className="rule-head">
        <h2>Jobs</h2>
        <span className="chip">{data.tasks.length}</span>
      </div>
      {data.tasks.length === 0 ? (
        <div className="panel panel--padded">No maintenance planned at this site.</div>
      ) : (
        <div className="panel table-scroll">
          <table className="ftable">
            <thead>
              <tr>{['Asset', 'Job', 'Calendared', 'BOB schedules', 'Must fit', 'Status'].map((h) => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {data.tasks.map((t) => (
                <tr key={t.id}>
                  <td><strong>{t.asset}</strong></td>
                  <td>
                    {t.kind}, {t.hours} h {t.safety_critical && <span className="badge badge--red">Safety-critical</span>}
                  </td>
                  <td>{simTime(t.calendar_at)}</td>
                  <td>{t.scheduled_at === t.calendar_at ? simTime(t.scheduled_at) : <strong>{simTime(t.scheduled_at)} (moved)</strong>}</td>
                  <td>{simTime(t.earliest_at)}–{simTime(t.deadline_at)}</td>
                  <td><span className={`badge badge--caps badge--${STATUS_TONE[t.status]}`}>{t.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="cell-sub">Today&apos;s practice keeps the calendared time; BOB&apos;s schedule changes only when you approve a move.</p>

      <div className="rule-head">
        <h2>BOB&apos;s proposals</h2>
        <span className="badge badge--amber">{open.length} waiting</span>
      </div>
      {open.length === 0 && <div className="panel panel--padded">No proposals waiting.</div>}
      {open.map((a) => <ActionCard key={a.id} action={a} run={run} />)}

      {decided.length > 0 && (
        <>
          <div className="rule-head"><h2>Earlier proposals</h2></div>
          <div className="panel">
            {decided.map((a) => (
              <div key={a.id} className="entry">
                <span className="cell-sub">{simTime(a.time)} IST</span>
                <strong>{actionLabel(a.kind, 0)} · {a.asset}</strong>
                <p>{a.reason}</p>
                <StatusBadge status={a.status} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
