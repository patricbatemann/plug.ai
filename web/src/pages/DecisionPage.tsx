import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BubbleChart, type BubbleChartOptions } from '@carbon/charts-react'
import {
  Breadcrumb,
  BreadcrumbItem,
  InlineNotification,
  SkeletonText,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
  Tile,
} from '@carbon/react'
import { runApi, type DecisionDetail } from '../api/client'
import { inr, modeLabel, simTime } from '../format'
import { SERIES } from '../theme/tokens'

export function DecisionPage() {
  const id = Number(useParams().id)
  const { data, error } = useQuery({ queryKey: ['decision-detail', id], queryFn: () => runApi.decision(id) })
  if (error) return <InlineNotification kind="error" title="Could not load the decision" subtitle={error.message} hideCloseButton lowContrast />
  if (!data) return <SkeletonText paragraph lineCount={8} />
  const scenarios = Object.entries(data.scenarios)

  return (
    <>
      <Breadcrumb noTrailingSlash>
        <BreadcrumbItem>
          <Link to="/portfolio">Portfolio</Link>
        </BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>Decision {simTime(data.time)}</BreadcrumbItem>
      </Breadcrumb>
      <h1 className="page-title">Decision for the block starting {simTime(data.time)} IST</h1>
      <div className="tag-row">
        <Tag type="purple">Mode: {modeLabel(data.mode)}</Tag>
        <Tag type="gray">{data.mode_by === 'operator' ? 'Operator default' : `Chosen by ${data.mode_by}`}</Tag>
        <Tag type="gray">Trigger: {data.trigger === 'tick' ? 'scheduled block' : data.trigger}</Tag>
      </div>

      <Tile className="decision__why">
        <div className="card-title">Why BOB chose “{data.chosen ?? 'nothing'}”</div>
        <p>{data.rationale}</p>
        <p className="page-meta">Mode: {data.mode_reason}</p>
        {data.floors.map((f) => (
          <p key={f} className="stat-label">Guard floor: {f}</p>
        ))}
      </Tile>

      <h2 className="section-title">What BOB saw</h2>
      <Table aria-label="Situation signals">
        <TableHead>
          <TableRow>
            <TableHeader>Signal</TableHeader>
            <TableHeader>Now</TableHeader>
            <TableHeader>Threshold</TableHeader>
            <TableHeader>Material</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.situation.map((s) => (
            <TableRow key={s.code}>
              <TableCell>{s.label}</TableCell>
              <TableCell>{s.value}</TableCell>
              <TableCell>{s.threshold}</TableCell>
              <TableCell>
                {s.material ? <Tag type="warm-gray">calls for {modeLabel(s.mode)}</Tag> : <Tag type="gray">no</Tag>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <h2 className="section-title">Options compared</h2>
      <Table aria-label="Options">
        <TableHead>
          <TableRow>
            <TableHeader>Option</TableHeader>
            <TableHeader>Commits to now</TableHeader>
            <TableHeader>Expected cost, 24 h</TableHeader>
            <TableHeader>Carbon</TableHeader>
            <TableHeader>Curtailment</TableHeader>
            <TableHeader>Worst-case regret</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.options.map((o) => (
            <TableRow key={o.variant}>
              <TableCell>
                {o.label} {o.chosen && <Tag type="purple" size="sm">chosen</Tag>}
              </TableCell>
              <TableCell>
                {o.actions.map((a) => (
                  <div key={a}>{a}</div>
                ))}
              </TableCell>
              <TableCell>{inr(o.cost_inr)}</TableCell>
              <TableCell>{o.carbon_t} t</TableCell>
              <TableCell>{o.curtailed_mwh} MWh</TableCell>
              <TableCell>{o.worst_regret_inr === null ? '—' : inr(o.worst_regret_inr)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {data.options.length > 1 && (
        <Tile className="decision__chart">
          <div className="card-title">Trade-off: cost against carbon (bubble size = worst-case regret)</div>
          <BubbleChart data={tradeOff(data)} options={tradeOffOptions(data)} />
        </Tile>
      )}

      {scenarios.length > 0 && (
        <>
          <h2 className="section-title">Stress tests: regret if this happens</h2>
          <Table aria-label="Stress tests">
            <TableHead>
              <TableRow>
                <TableHeader>Option</TableHeader>
                {scenarios.map(([code, label]) => (
                  <TableHeader key={code}>{label}</TableHeader>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {data.options.map((o) => (
                <TableRow key={o.variant}>
                  <TableCell>
                    {o.label} {o.chosen && <Tag type="purple" size="sm">chosen</Tag>}
                  </TableCell>
                  {scenarios.map(([code]) => {
                    const r = o.stress[code]
                    return (
                      <TableCell key={code}>
                        {r.regret_inr === null ? 'infeasible' : inr(r.regret_inr)}
                        {!r.holds && <Tag type="red" size="sm">load at risk</Tag>}
                        {!!r.reserve_shortfall_mwh && (
                          <div className="stat-label">reserve short {r.reserve_shortfall_mwh} MWh</div>
                        )}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </>
  )
}

function tradeOff(data: DecisionDetail) {
  return data.options.map((o) => ({
    group: o.label,
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
    bubble: { radiusMapsTo: 'regret', radiusLabel: 'Worst-case regret (₹)' },
    color: {
      scale: Object.fromEntries(data.options.map((o) => [o.label, o.chosen ? SERIES.bob : SERIES.baseline])),
    },
    legend: { truncation: { numCharacter: 40 } },
  }
}
