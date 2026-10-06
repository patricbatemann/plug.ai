import { Link } from 'react-router-dom'
import { Button, InlineNotification } from '@carbon/react'
import type { ActionOut, RunState } from '../api/client'
import { WORK_ORDERS, actionLabel, mw, simTime } from '../format'
import { useAskBob } from './AskBob'
import { useDecide } from './useActions'

/** One gated or recommended action, with the reason it needs a person and its deadline. */
export function ActionCard({ action, run }: { action: ActionOut; run: RunState }) {
  const decide = useDecide(run)
  const ask = useAskBob()
  const workOrder = WORK_ORDERS.includes(action.kind)
  const gated = action.tier === 'approval'
  const minutesLeft = action.deadline_at
    ? Math.max(0, Math.round((Date.parse(action.deadline_at) - Date.parse(run.sim_time)) / 60000))
    : null
  const label = `${actionLabel(action.kind, action.mw)}${workOrder ? '' : ` · ${mw(Math.abs(action.mw))}`}`
  return (
    <div className="panel rec-card">
      <div className="rec-card__head">
        <div>
          <div className="rec-card__site"><span className={`dot dot--${gated ? 'warning' : 'purple'}`} />{action.site ?? 'Portfolio'}</div>
          <div className="cell-sub">{action.asset && `${action.asset} · `}for {simTime(action.time)} IST</div>
        </div>
        <div className="chip-row chip-row--tight">
          <span className="badge badge--purple">AI-generated</span>
          <span className={`badge badge--${gated ? 'amber' : 'gray'}`}>{gated ? 'Awaiting approval' : 'Recommendation only'}</span>
        </div>
      </div>
      <h3 className="rec-card__title">{label}</h3>
      <div className="rec-card__why">
        <strong>{workOrder ? 'Why BOB proposes this' : gated ? 'Why it needs you' : 'Why BOB recommends this'}</strong>
        <p>{action.reason}</p>
      </div>
      <div className="stat-strip">
        <div><span className="caps-label">Suggested action</span><strong className="text-interactive">{label}</strong></div>
        <div><span className="caps-label">For block</span><strong>{simTime(action.time)} IST</strong></div>
        <div>
          <span className="caps-label">Respond within</span>
          <strong className="text-caution">{minutesLeft === null ? 'No deadline' : `${minutesLeft} min (sim time)`}</strong>
        </div>
        <div>
          <span className="caps-label">Until you decide</span>
          <strong>{workOrder ? 'The calendar stays as it is' : 'BOB runs a fallback plan'}</strong>
        </div>
      </div>
      {decide.error && <InlineNotification kind="error" title={decide.error.message} hideCloseButton lowContrast />}
      <div className="rec-card__foot">
        <div className="rec-card__links">
          <button type="button" className="text-link" onClick={() => ask(`Explain action ${action.id}: why is it needed now?`)}>Ask BOB</button>
          {action.cycle_id && <Link className="text-link" to={`/decisions/${action.cycle_id}`}>View evidence</Link>}
        </div>
        {gated && (
          <div className="rec-card__buttons">
            <Button kind="tertiary" className="btn-tall" onClick={() => decide.mutate({ id: action.id, approve: false })}>Decline</Button>
            <Button className="btn-tall" onClick={() => decide.mutate({ id: action.id, approve: true })}>Approve</Button>
          </div>
        )}
      </div>
    </div>
  )
}
