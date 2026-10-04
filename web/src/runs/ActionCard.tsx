import { Link } from 'react-router-dom'
import { Button, InlineNotification, Tag, Tile } from '@carbon/react'
import type { ActionOut, RunState } from '../api/client'
import { actionLabel, mw, simTime } from '../format'
import { useAskBob } from './AskBob'
import { useDecide } from './useActions'

/** One gated or recommended action, with the reason it needs a person and its deadline. */
export function ActionCard({ action, run }: { action: ActionOut; run: RunState }) {
  const decide = useDecide(run)
  const ask = useAskBob()
  const minutesLeft = action.deadline_at
    ? Math.max(0, Math.round((Date.parse(action.deadline_at) - Date.parse(run.sim_time)) / 60000))
    : null
  return (
    <Tile className="action-card">
      <div className="action-card__head">
        <span className="stat-label">
          {action.site ?? 'Portfolio'} · for {simTime(action.time)} IST
        </span>
        <Tag type="purple" size="sm">AI-generated</Tag>
        {action.tier === 'approval' ? (
          <Tag type="warm-gray" size="sm">Awaiting approval</Tag>
        ) : (
          <Tag type="cool-gray" size="sm">Recommendation only</Tag>
        )}
      </div>
      <h3 className="card-title">
        {actionLabel(action.kind, action.mw)} · {mw(Math.abs(action.mw))}
        {action.asset && <span className="stat-label"> · {action.asset}</span>}
      </h3>
      <div className="action-card__why">
        <div className="stat-label">Why it needs you</div>
        <p>{action.reason}</p>
        <p className="stat-label">Until you decide, BOB runs a fallback plan without this action.</p>
      </div>
      {decide.error && <InlineNotification kind="error" title={decide.error.message} hideCloseButton lowContrast />}
      <div className="action-card__foot">
        {action.cycle_id && (
          <Link className="cds--link" to={`/decisions/${action.cycle_id}`}>
            View evidence
          </Link>
        )}
        <Button kind="ghost" size="sm" onClick={() => ask(`Explain action ${action.id}: why is it needed now?`)}>
          Ask BOB
        </Button>
        {minutesLeft !== null && <span className="stat-label">Respond within {minutesLeft} min (sim time)</span>}
        {action.tier === 'approval' && (
          <>
            <Button kind="tertiary" size="sm" onClick={() => decide.mutate({ id: action.id, approve: false })}>
              Decline
            </Button>
            <Button size="sm" onClick={() => decide.mutate({ id: action.id, approve: true })}>
              Approve
            </Button>
          </>
        )}
      </div>
    </Tile>
  )
}
