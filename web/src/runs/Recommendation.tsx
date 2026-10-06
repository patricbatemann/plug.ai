import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@carbon/react'
import { ArrowRight, Bot, ChartColumn, Information, MagicWand } from '@carbon/icons-react'
import { runApi, type RunState } from '../api/client'
import { modeLabel, sentence, simTime } from '../format'
import { ActionCard } from './ActionCard'
import { useAskBob } from './AskBob'
import { useOpenActions } from './useActions'

/** BOB's latest decision, as on the Monitor Sites screen, with what it is doing now and a link to its evidence. */
export function Recommendation({ run }: { run: RunState }) {
  const { data } = useQuery({
    queryKey: ['decision', run.id, run.block],
    queryFn: () => runApi.latestDecision(run.id),
  })
  const sites = useQuery({ queryKey: ['sites-status', run.id, run.block], queryFn: () => runApi.sites(run.id) })
  const ask = useAskBob()
  const open = useOpenActions(run).data ?? []
  if (!data) return null

  const doing = (sites.data ?? []).flatMap((s) => s.bob_now)
  const more = doing.length > 3 ? `; and ${doing.length - 3} more setpoints` : ''
  const response = doing.length
    ? `${sentence(doing.slice(0, 3).join('; '))}${more}.`
    : 'BOB is holding: no setpoint changes in this block.'

  return (
    <section>
      <div className="section-head">
        <h2 className="section-head__title"><ChartColumn size={16} className="icon-accent" />BOB recommendations</h2>
        <Link to="/actions" className="text-link text-link--icon">View all actions <ArrowRight size={16} /></Link>
      </div>
      <div className="panel rec">
        <div className="rec__head">
          <div className="rec__who">
            <span className="bob-mark">BOB</span>
            <div>
              <div className="rec__name">BOB</div>
              <div className="cell-sub">AI energy operations</div>
            </div>
            <span className="chip chip--warning">
              <span className="dot dot--warning" />
              {open.length ? 'Admin approval required' : `${modeLabel(data.mode)} mode`}
            </span>
          </div>
          <span className="rec__time">Latest analysis · {simTime(data.time)} IST</span>
        </div>

        <h3 className="rec__title">{modeLabel(data.mode)} mode · {data.chosen ?? 'no feasible option'}</h3>
        <p className="rec__text">{data.mode_reason}</p>
        <div className="rec__impact">
          <h4><Information size={16} />Operational impact</h4>
          <p>{data.rationale}</p>
        </div>
        <div className="rec__response">
          <h4><Bot size={16} />Current response</h4>
          {open.length > 0 ? (
            <>
              <p>
                {open.length} {open.length === 1 ? 'action needs' : 'actions need'} a decision ·{' '}
                <Link className="text-link" to="/actions">all of them</Link>
              </p>
              <ActionCard action={open[0]} run={run} />
            </>
          ) : <p>{response}</p>}
        </div>

        <div className="rec__buttons">
          <Button as={Link} to={`/decisions/${data.id}`} className="btn-tall">View evidence</Button>
          <Button kind="tertiary" className="btn-tall" onClick={() => ask(`Explain the decision for ${simTime(data.time)}.`)}>
            <MagicWand size={14} className="btn-lead-icon" />Ask BOB
          </Button>
        </div>
      </div>
    </section>
  )
}
