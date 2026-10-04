import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button, Tag, Tile } from '@carbon/react'
import { runApi, type RunState } from '../api/client'
import { modeLabel, simTime } from '../format'
import { ActionCard } from './ActionCard'
import { useAskBob } from './AskBob'
import { useOpenActions } from './useActions'

/** BOB's latest decision, as on the Monitor Sites screen, with a link to its evidence. */
export function Recommendation({ run }: { run: RunState }) {
  const { data } = useQuery({
    queryKey: ['decision', run.id, run.block],
    queryFn: () => runApi.latestDecision(run.id),
  })
  const ask = useAskBob()
  const open = useOpenActions(run).data ?? []
  if (!data) return null
  return (
    <Tile className="recommendation">
      {open.length > 0 && (
        <>
          <div className="recommendation__head">
            <Tag type="warm-gray">Waiting for you</Tag>
            <span className="stat-label">
              {open.length} {open.length === 1 ? 'action needs' : 'actions need'} a decision ·{' '}
              <Link className="cds--link" to="/actions">all of them</Link>
            </span>
          </div>
          <ActionCard action={open[0]} run={run} />
        </>
      )}
      <div className="recommendation__head">
        <Tag type="purple">BOB · AI energy operations</Tag>
        <span className="stat-label">Decision for {simTime(data.time)} IST</span>
      </div>
      <h2 className="card-title">
        {modeLabel(data.mode)} mode · {data.chosen ?? 'no feasible option'}
      </h2>
      <p className="page-meta">{data.mode_reason}</p>
      <p>{data.rationale}</p>
      <div className="recommendation__foot">
        {data.tests > 0 && (
          <Tag type={data.holds === data.tests ? 'green' : 'warm-gray'}>
            Load served in {data.holds}/{data.tests} stress tests
          </Tag>
        )}
        <Button kind="ghost" size="sm" onClick={() => ask(`Explain the decision for ${simTime(data.time)}.`)}>
          Ask BOB
        </Button>
        <Link className="cds--link" to={`/decisions/${data.id}`}>
          View evidence
        </Link>
      </div>
    </Tile>
  )
}
