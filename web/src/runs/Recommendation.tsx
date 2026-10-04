import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Tag, Tile } from '@carbon/react'
import { runApi, type RunState } from '../api/client'
import { modeLabel, simTime } from '../format'

/** BOB's latest decision, as on the Monitor Sites screen, with a link to its evidence. */
export function Recommendation({ run }: { run: RunState }) {
  const { data } = useQuery({
    queryKey: ['decision', run.id, run.block],
    queryFn: () => runApi.latestDecision(run.id),
  })
  if (!data) return null
  return (
    <Tile className="recommendation">
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
        <Link className="cds--link" to={`/decisions/${data.id}`}>
          View evidence
        </Link>
      </div>
    </Tile>
  )
}
