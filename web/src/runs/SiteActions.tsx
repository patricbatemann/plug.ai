import { useQuery } from '@tanstack/react-query'
import { SkeletonText } from '@carbon/react'
import { configApi, runApi, type RunState } from '../api/client'
import { actionLabel, mw, simTime, statusOf } from '../format'
import { ActionCard } from './ActionCard'
import { StatusBadge } from './StatusBadge'
import { useOpenActions } from './useActions'

/** The site's AI Actions tab: what runs now, what waits for a person, and what ran recently. */
export function SiteActions({ run, site }: { run: RunState; site: string }) {
  const open = useOpenActions(run, site)
  const recent = useQuery({
    queryKey: ['actions', 'site', run.id, site, run.block],
    queryFn: () => runApi.actions(run.id, { status: ['acked', 'verified'], site, limit: 15 }),
  })
  // Asked for by block: trades and calls placed for later blocks would crowd them out of `recent`.
  const executing = useQuery({
    queryKey: ['actions', 'site', 'now', run.id, site, run.block],
    queryFn: () => runApi.actions(run.id, { status: ['acked'], site, block: run.block + 1, limit: 30 }),
  })
  const watch = useQuery({
    queryKey: ['watch', run.id, site, run.block],
    queryFn: () => configApi.watch(run.id, site),
  })
  if (!open.data || !recent.data || !executing.data) return <SkeletonText paragraph lineCount={4} />
  const now = executing.data
  const earlier = recent.data.filter((a) => a.block <= run.block)

  return (
    <div className="stack">
      <p className="cell-sub">Simulated time {simTime(run.sim_time)} IST · commands go to the simulated plant adapters.</p>
      <div className="rule-head">
        <h2>Currently executing</h2>
        <span className="chip">{now.length} {now.length === 1 ? 'setpoint' : 'setpoints'} this block</span>
      </div>
      {now.length === 0 && <div className="panel panel--padded">No setpoints for this site in the current block.</div>}
      {now.map((a) => (
        <div key={a.id} className="panel panel--padded exec">
          <div className="panel__head">
            <div>
              <strong>{actionLabel(a.kind, a.mw)} {mw(Math.abs(a.mw))}</strong>
              <div className="cell-sub">{a.site ?? 'Portfolio'}{a.asset && ` · ${a.asset}`}</div>
            </div>
            <span className="chip chip--round">{a.decided_by ? `Approved by ${a.decided_by}` : 'BOB, automatic'}</span>
          </div>
          <div className="stat-strip">
            <div><span className="caps-label">Block</span><strong>{simTime(a.time)} IST</strong></div>
            <div><span className="caps-label">Commanded</span><strong>{mw(Math.abs(a.mw))}</strong></div>
            <div><span className="caps-label">Delivered</span><strong>{a.delivered_mw === null ? '—' : mw(Math.abs(a.delivered_mw))}</strong></div>
            <div><span className="caps-label">Status</span><strong>{statusOf(a.status).label}</strong></div>
          </div>
        </div>
      ))}

      <div className="rule-head">
        <h2>Pending approval</h2>
        <span className="badge badge--amber">{open.data.length} required</span>
      </div>
      {open.data.length === 0 && <div className="panel panel--padded">Nothing waiting for this site.</div>}
      {open.data.map((a) => <ActionCard key={a.id} action={a} run={run} />)}

      <div className="rule-head">
        <h2>Watch conditions</h2>
        <span className="chip">{watch.data?.length ?? 0}</span>
      </div>
      <div className="panel panel--padded">
        {watch.data?.length === 0 && 'No watch conditions. Add them in Configure BOB.'}
        {watch.data?.map((w) => (
          <div key={`${w.asset}-${w.label}`} className="kv-line">
            <span>{w.asset}: {w.label} <span className="cell-sub">now {w.value === null ? '—' : w.value.toFixed(1)}</span></span>
            <span className={`badge badge--${w.met ? 'amber' : 'gray'}`}>{w.met ? 'Crossed: BOB re-planned' : 'Watching'}</span>
          </div>
        ))}
      </div>

      <div className="rule-head"><h2>Recently verified</h2></div>
      <ActionTable rows={earlier} empty="No verified actions yet." />
    </div>
  )
}

function ActionTable({ rows, empty }: { rows: Awaited<ReturnType<typeof runApi.actions>>; empty: string }) {
  if (rows.length === 0) return <div className="panel panel--padded">{empty}</div>
  return (
    <div className="panel table-scroll">
      <table className="ftable">
        <thead><tr><th>Block</th><th>Action</th><th>Commanded</th><th>Measured</th><th>Status</th></tr></thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id}>
              <td>{simTime(a.time)}</td>
              <td>{actionLabel(a.kind, a.mw)}{a.asset && <div className="cell-sub">{a.asset}</div>}</td>
              <td>{mw(Math.abs(a.mw))}</td>
              <td>{a.actual_mw === null ? '—' : mw(a.actual_mw)}</td>
              <td><StatusBadge status={a.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
