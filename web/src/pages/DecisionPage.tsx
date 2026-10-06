import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BubbleChart, LegendItemType, type BubbleChartOptions } from '@carbon/charts-react'
import { InlineNotification, SkeletonText } from '@carbon/react'
import { Bot, CloseOutline } from '@carbon/icons-react'
import { portfolioApi, runApi, type DecisionDetail } from '../api/client'
import { inr, modeLabel, simTime } from '../format'
import { SERIES } from '../theme/tokens'

export function DecisionPage() {
  const id = Number(useParams().id)
  const { data, error } = useQuery({ queryKey: ['decision-detail', id], queryFn: () => runApi.decision(id) })
  const limits = useQuery({ queryKey: ['portfolio'], queryFn: portfolioApi.get }).data?.protected
  if (error) return <InlineNotification kind="error" title="Could not load the decision" subtitle={error.message} hideCloseButton lowContrast />
  if (!data) return <SkeletonText paragraph lineCount={8} />
  const scenarios = Object.entries(data.scenarios)
  const chosen = data.options.find((o) => o.chosen)
  const chosenActions = new Set(chosen?.actions ?? [])
  const by = data.selected_by === 'bob' ? 'BOB' : 'BOB (rules)'

  return (
    <>
      <div className="review-bar">
        <span className="bob-mark"><Bot size={20} /></span>
        <h1>Decision · {simTime(data.time)} IST</h1>
        <span className="badge badge--purple">Mode: {modeLabel(data.mode)}</span>
        <Link to="/portfolio" className="review-bar__close" aria-label="Back to portfolio"><CloseOutline size={20} /></Link>
      </div>

      <div className="review">
        <div className="review__main">
          <div className={`callout callout--${data.trigger === 'tick' ? 'info' : 'warning'}`}>
            <span className="dot" />
            <div>
              <strong>{data.trigger === 'tick' ? 'Scheduled block' : 'Re-planned on an event'}</strong>
              <p>{data.trigger === 'tick' ? 'BOB plans every 15-minute block from the latest forecasts.' : data.trigger_detail}</p>
            </div>
          </div>

          <section className="panel">
            <div className="review__card-head"><span className="icon-box icon-box--brand"><Bot size={16} /></span>{by} decision · {simTime(data.time)} IST</div>
            <div className="review__body">
              {data.floors.map((f) => <p key={f} className="boundary">Guard floor: {f}</p>)}
              <p>{data.rationale}</p>
              <p>{data.mode_reason}</p>
              {data.agent?.startsWith('fallback') && (
                <p className="cell-sub">BOB was asked but could not decide ({data.agent.replace('fallback: ', '')}); rules decided.</p>
              )}

              <div className="balance">
                <h3 className="subhead">What BOB saw</h3>
                {data.situation.map((sig) => (
                  <div key={sig.code} className="kv-line">
                    <span>{sig.label} <span className="cell-sub">threshold {sig.threshold}</span></span>
                    <strong className={sig.material ? 'text-caution' : undefined}>
                      {sig.value}{sig.material && ` · calls for ${modeLabel(sig.mode)}`}
                    </strong>
                  </div>
                ))}
              </div>

              {chosen && scenarios.length > 0 && (
                <div className="outcome-grid">
                  {scenarios.map(([code, label]) => {
                    const r = chosen.stress[code]
                    const tone = r.regret_inr === null ? 'gray' : !r.holds ? 'red' : r.reserve_shortfall_mwh ? 'amber' : 'blue'
                    return (
                      <div key={code} className={`outcome outcome--${tone}`}>
                        <strong>{label}</strong>
                        <p>
                          {r.regret_inr === null ? 'The chosen plan is infeasible.' : `Regret ${inr(r.regret_inr)}.`}{' '}
                          {r.holds ? 'All load stays served.' : 'Load is at risk.'}
                          {!!r.reserve_shortfall_mwh && ` Reserve short ${r.reserve_shortfall_mwh} MWh.`}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </section>

          <section className="panel panel--padded">
            <h2 className="panel__title panel__title--small">Options compared</h2>
            <div className="table-scroll">
              <table className="ftable">
                <thead>
                  <tr>
                    <th>Option</th><th>Commits to now (others: only what differs)</th><th>Expected cost, 24 h</th>
                    <th>Carbon</th><th>Curtailment</th><th>Worst-case regret</th>
                  </tr>
                </thead>
                <tbody>
                  {data.options.map((o) => (
                    <tr key={o.variant}>
                      <td><strong>{o.label}</strong> {o.chosen && <span className="badge badge--purple">chosen</span>}</td>
                      <td>
                        {(o.chosen ? o.actions : o.actions.filter((a) => !chosenActions.has(a))).map((a) => <div key={a}>{a}</div>)}
                        {!o.chosen && o.actions.every((a) => chosenActions.has(a)) && <span className="cell-sub">The same as the chosen option</span>}
                      </td>
                      <td>{inr(o.cost_inr)}</td>
                      <td>{o.carbon_t} t</td>
                      <td>{o.curtailed_mwh} MWh</td>
                      <td>{o.worst_regret_inr === null ? '—' : inr(o.worst_regret_inr)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {data.options.length > 1 && (
            <section className="panel panel--padded">
              <h2 className="panel__title panel__title--small">Trade-off: cost against carbon (bubble size = worst-case regret)</h2>
              <BubbleChart data={tradeOff(data)} options={tradeOffOptions(data)} />
            </section>
          )}

          {scenarios.length > 0 && (
            <section className="panel panel--padded">
              <h2 className="panel__title panel__title--small">Stress tests: regret if this happens</h2>
              <div className="table-scroll">
                <table className="ftable">
                  <thead><tr><th>Option</th>{scenarios.map(([code, label]) => <th key={code}>{label}</th>)}</tr></thead>
                  <tbody>
                    {data.options.map((o) => (
                      <tr key={o.variant}>
                        <td><strong>{o.label}</strong> {o.chosen && <span className="badge badge--purple">chosen</span>}</td>
                        {scenarios.map(([code]) => {
                          const r = o.stress[code]
                          return (
                            <td key={code}>
                              {r.regret_inr === null ? 'infeasible' : inr(r.regret_inr)}
                              {!r.holds && <> <span className="badge badge--red">load at risk</span></>}
                              {!!r.reserve_shortfall_mwh && <div className="cell-sub">reserve short {r.reserve_shortfall_mwh} MWh</div>}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>

        <aside className="review__side">
          <h2 className="review__side-title">Policy context</h2>
          <div className="review__side-body">
            <p className="cell-sub">How this decision was made, and the limits no option may cross.</p>
            <h3 className="subhead">Decision</h3>
            <dl className="kv kv--compact kv--small">
              <div><dt>Mode</dt><dd>{modeLabel(data.mode)}</dd></div>
              <div><dt>Mode set by</dt><dd>{data.mode_by === 'operator' ? 'Operator default' : data.mode_by === 'bob' ? 'BOB' : 'Rule'}</dd></div>
              <div><dt>Option chosen by</dt><dd>{by}</dd></div>
              <div><dt>Trigger</dt><dd>{data.trigger === 'tick' ? 'Scheduled block' : 'Event'}</dd></div>
              <div><dt>Options compared</dt><dd>{data.options.length}</dd></div>
            </dl>
            {limits && (
              <>
                <h3 className="subhead">Protected limits</h3>
                <dl className="kv kv--compact kv--small">
                  {limits.battery_soc_floor_pct !== undefined && <div><dt>Battery reserve</dt><dd>≥ {limits.battery_soc_floor_pct}%</dd></div>}
                  {limits.approval_above_mw !== undefined && <div><dt>Approval required</dt><dd>&gt; {limits.approval_above_mw} MW</dd></div>}
                </dl>
              </>
            )}
            <div className="policy-note">
              <strong>Approval policy</strong>
              <p>Actions above an automatic limit wait for a person. Until then BOB runs a fallback plan without them.</p>
            </div>
          </div>
        </aside>
      </div>
    </>
  )
}

const legendLabel = (o: DecisionDetail['options'][number]) => (o.chosen ? `${o.label} (chosen)` : o.label)

function tradeOff(data: DecisionDetail) {
  return data.options.map((o) => ({
    group: legendLabel(o),
    cost: o.cost_inr,
    carbon: o.carbon_t,
    regret: Math.max(o.worst_regret_inr ?? 0, 1),
  }))
}

function tradeOffOptions(data: DecisionDetail): BubbleChartOptions {
  return {
    height: '300px',
    toolbar: { enabled: false },
    axes: {
      bottom: { mapsTo: 'cost', title: 'Expected cost over 24 h (₹)', includeZero: false },
      left: { mapsTo: 'carbon', title: 'Carbon from imports (t)', includeZero: false },
    },
    // Size shows worst-case regret; a floor keeps the least-regret option visible.
    bubble: { radiusMapsTo: 'regret', radiusLabel: 'Worst-case regret (₹)', radiusRange: () => [8, 26] },
    color: {
      scale: Object.fromEntries(data.options.map((o) => [legendLabel(o), o.chosen ? SERIES.bob : SERIES.baseline])),
    },
    legend: {
      truncation: { numCharacter: 40 },
      additionalItems: [{ type: LegendItemType.RADIUS, name: 'Size: worst-case regret' }],
    },
  }
}
