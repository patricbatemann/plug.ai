import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { SkeletonText } from '@carbon/react'
import { ArrowLeft } from '@carbon/icons-react'
import { runApi } from '../api/client'
import { actionLabel, mw, simTime } from '../format'
import { ActionCard } from '../runs/ActionCard'
import { useOpenActions } from '../runs/useActions'
import { useCurrentRun } from '../runs/useCurrentRun'

export function ActionsPage() {
  const { data: run } = useCurrentRun()
  const open = useOpenActions(run)
  const executing = useQuery({
    queryKey: ['actions', 'executing', run?.id, run?.block],
    queryFn: () => runApi.actions(run!.id, { status: ['acked'], block: run!.block + 1, limit: 50 }),
    enabled: !!run,
  })
  // Soonest deadline first; recommend-only actions, which have none, last.
  const waiting = [...(open.data ?? [])].sort((a, b) => (a.deadline_at ?? '~').localeCompare(b.deadline_at ?? '~'))

  return (
    <>
      <Link to="/portfolio" className="text-link text-link--icon back-link"><ArrowLeft size={16} />Back to portfolio</Link>
      <h1 className="page-title page-title--bold">All AI recommendations</h1>
      <p className="page-intro">
        Actions BOB wants to take but may not take alone: approve or decline before the window closes. Nothing
        gated runs until it is approved; BOB keeps a fallback plan running meanwhile.
      </p>
      {!run ? (
        <div className="panel panel--padded">Start a run from the header to see BOB's recommendations.</div>
      ) : !open.data ? (
        <SkeletonText paragraph lineCount={4} />
      ) : (
        <div className="stack">
          <div className="section-head section-head--spaced">
            <div>
              <h2 className="section-head__big">Recommendations requiring attention</h2>
              <p className="cell-sub">{waiting.length} waiting, soonest deadline first</p>
            </div>
            <span className="status-chip">Sorted by deadline</span>
          </div>
          {waiting.length === 0 && <div className="panel panel--padded">Nothing needs you right now.</div>}
          {waiting.map((a) => <ActionCard key={a.id} action={a} run={run} />)}

          <div className="section-head section-head--spaced">
            <h2 className="section-head__big">Executing this block</h2>
            <span className="cell-sub">{executing.data?.length ?? 0} setpoints at {simTime(run.sim_time)} IST</span>
          </div>
          <div className="mini-grid">
            {(executing.data ?? []).map((a) => (
              <div key={a.id} className="panel mini-card">
                <div className="mini-card__head">
                  <strong>{a.site ?? 'Portfolio'}</strong>
                  <span className="badge badge--blue">Executing</span>
                </div>
                <h3>{actionLabel(a.kind, a.mw)} · {mw(Math.abs(a.delivered_mw ?? a.mw))}</h3>
                <p className="cell-sub">
                  {a.asset ? `${a.asset} · ` : ''}{a.decided_by ? `approved by ${a.decided_by}` : 'automatic, within limits'}
                </p>
                {a.cycle_id && <Link className="text-link" to={`/decisions/${a.cycle_id}`}>View evidence</Link>}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
