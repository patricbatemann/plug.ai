import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { BoxplotChart, ScaleTypes, type BoxplotChartOptions } from '@carbon/charts-react'
import {
  Button, FilterableMultiSelect, InlineNotification, NumberInput, ProgressBar, Select, SelectItem, SkeletonText,
} from '@carbon/react'
import { portfolioApi, runApi, simulationApi, type Study, type WhatIfChange } from '../api/client'
import { inr, MODES, modeLabel, simTime } from '../format'
import { useCurrentRun } from '../runs/useCurrentRun'
import { WhatIfTable } from '../runs/WhatIfTable'
import { SERIES } from '../theme/tokens'

export function SimulationPage() {
  return (
    <>
      <h1 className="page-title page-title--bold">Simulation</h1>
      <p className="page-intro">
        Try a change against the block in progress, or replay a scenario over many seeds to compare BOB with
        today&apos;s practice. Nothing here is sent to any asset.
      </p>
      <div className="stack">
        <WhatIf />
        <Replay />
      </div>
    </>
  )
}

const pct = (value: number | string) => (value === '' ? null : Number(value))

function WhatIf() {
  const { data: run } = useCurrentRun()
  const portfolio = useQuery({ queryKey: ['portfolio'], queryFn: portfolioApi.get })
  const [change, setChange] = useState<WhatIfChange>({
    assets_out: [], demand_pct: null, renewables_pct: null, price_pct: null, line_limits: [], mode: null,
  })
  const compare = useMutation({ mutationFn: () => simulationApi.whatIf(run!.id, change) })
  if (!portfolio.data) return <SkeletonText paragraph lineCount={4} />
  const outable = portfolio.data.assets.filter((a) => ['bess', 'solar', 'wind'].includes(a.kind))
  const limit = (line: string) => change.line_limits.find((l) => l.line === line)?.limit_mw ?? ''
  const setLimit = (line: string, value: number | string) => setChange({
    ...change,
    line_limits: [...change.line_limits.filter((l) => l.line !== line),
      ...(value === '' ? [] : [{ line, limit_mw: Number(value) }])],
  })

  return (
    <section className="panel panel--padded simulation__panel">
      <div className="panel__head">
        <h2 className="panel__title">What-if</h2>
        <span className="badge badge--gray">Plans the block in progress</span>
      </div>
      <div className="simulation__form">
        <FilterableMultiSelect id="assets-out" titleText="Assets out of service" placeholder="None"
          items={outable} itemToString={(a) => a?.name ?? ''}
          onChange={({ selectedItems }) => setChange({ ...change, assets_out: selectedItems.map((a) => a.code) })} />
        {([['demand_pct', 'Demand change (%)'], ['renewables_pct', 'Renewables change (%)'],
          ['price_pct', 'Price change (%)']] as const).map(([key, label]) => (
          <NumberInput key={key} id={key} label={label} allowEmpty hideSteppers value={change[key] ?? ''}
            onChange={(_, { value }) => setChange({ ...change, [key]: pct(value) })} />
        ))}
        {portfolio.data.lines.map((l) => (
          <NumberInput key={l.code} id={`limit-${l.code}`} label={`${l.name} limit (MW)`} allowEmpty hideSteppers
            placeholder="As now" value={limit(l.code)} onChange={(_, { value }) => setLimit(l.code, value)} />
        ))}
        <Select id="mode" labelText="Operating mode" value={change.mode ?? ''}
          onChange={(e) => setChange({ ...change, mode: e.target.value || null })}>
          <SelectItem value="" text="As now" />
          {MODES.map((m) => <SelectItem key={m} value={m} text={modeLabel(m)} />)}
        </Select>
      </div>
      <Button className="btn-tall" disabled={!run || compare.isPending} onClick={() => compare.mutate()}>
        {compare.isPending ? 'Planning…' : 'Compare plans'}
      </Button>
      {!run && <p className="cell-sub">Start a run first: the what-if plans the block in progress.</p>}
      {compare.error && <InlineNotification kind="error" lowContrast hideCloseButton title={compare.error.message} />}
      {compare.data && <WhatIfTable current={compare.data.current} whatIf={compare.data.what_if} actions />}
    </section>
  )
}

function Replay() {
  const presets = useQuery({ queryKey: ['presets'], queryFn: runApi.presets })
  const past = useQuery({ queryKey: ['studies'], queryFn: simulationApi.studies })
  const [preset, setPreset] = useState('demo_story')
  const [seeds, setSeeds] = useState(5)
  const [chosen, setChosen] = useState<number | null>(null)
  const id = chosen ?? past.data?.[0]?.id ?? null
  const study = useQuery({
    queryKey: ['study', id],
    queryFn: () => simulationApi.study(id!),
    enabled: id !== null,
    refetchInterval: (q) => (q.state.data?.seeds.every((s) => s.done) ? false : 2000),
  })
  const start = useMutation({
    mutationFn: () => simulationApi.createStudy(preset, seeds),
    onSuccess: (s) => { setChosen(s.id); past.refetch() },
  })

  return (
    <section className="panel panel--padded simulation__panel">
      <h2 className="panel__title">Replay: BOB vs today&apos;s practice</h2>
      <p className="cell-sub">
        Each seed is a different day of weather, demand and prices with the same events. Replays fast-forward every
        block: the rules choose the mode and one plan per block, without the live run&apos;s options, stress tests
        or model calls. Nobody answers approvals, so BOB&apos;s fallback does only what it may do alone.
      </p>
      <div className="simulation__form">
        <Select id="preset" labelText="Scenario" value={preset} onChange={(e) => setPreset(e.target.value)}>
          {presets.data?.map((p) => <SelectItem key={p.code} value={p.code} text={p.name} />)}
        </Select>
        <NumberInput id="seeds" label="Seeds (1–20)" min={1} max={20} value={seeds}
          onChange={(_, { value }) => setSeeds(Number(value))} />
        {past.data && past.data.length > 0 && (
          <Select id="study" labelText="Show replay" value={id ?? ''} onChange={(e) => setChosen(Number(e.target.value))}>
            {past.data.map((s) => (
              <SelectItem key={s.id} value={s.id} text={`#${s.id} ${s.preset}, ${s.seeds} seeds, ${simTime(s.created_at)}`} />
            ))}
          </Select>
        )}
      </div>
      <Button className="btn-tall" disabled={start.isPending || seeds < 1 || seeds > 20} onClick={() => start.mutate()}>
        {start.isPending ? 'Starting…' : 'Start replay'}
      </Button>
      {start.error && <InlineNotification kind="error" lowContrast hideCloseButton title={start.error.message} />}
      {study.data && <StudyResult study={study.data} />}
    </section>
  )
}

function StudyResult({ study }: { study: Study }) {
  const calls = useQuery({ queryKey: ['bob-calls'], queryFn: simulationApi.bobCalls })
  const done = study.seeds.filter((s) => s.done)
  const progress = study.seeds.reduce((sum, s) => sum + s.progress, 0) / study.seeds.length
  const r = study.reliability
  return (
    <div className="simulation__result">
      {done.length < study.seeds.length && (
        <ProgressBar label={`Replaying ${study.seeds.length} seeds of ${study.preset}`} value={progress * 100}
          helperText={`${done.length} of ${study.seeds.length} done; the worker advances them block by block`} />
      )}
      {done.length > 0 && (
        <>
          <div className="card-grid">
            {Object.entries(study.metrics).map(([key, label]) => (
              <div key={key} className="panel panel--padded simulation__chart">
                <BoxplotChart data={done.flatMap((s) => [
                  { group: 'BOB', value: s.bob![key as keyof typeof s.bob] },
                  { group: "Today's practice", value: s.baseline![key as keyof typeof s.baseline] },
                ])} options={boxOptions(label)} />
              </div>
            ))}
          </div>
          <h3 className="subhead">Reliability</h3>
          <div className="chip-row chip-row--tight">
            <span className={`badge badge--${r.hard_limit_violations ? 'red' : 'green'}`}>Hard-limit violations: {r.hard_limit_violations}</span>
            <span className={`badge badge--${r.unserved_mwh.bob ? 'red' : 'green'}`}>Unserved energy, BOB: {r.unserved_mwh.bob} MWh</span>
            <span className="badge badge--gray">Today&apos;s practice: {r.unserved_mwh.baseline} MWh</span>
            <span className={`badge badge--${r.safe_holds ? 'amber' : 'gray'}`}>Safe holds: {r.safe_holds}</span>
            <span className="badge badge--gray">Approvals nobody answered: {r.approvals_expired}</span>
          </div>
          {calls.data && (
            <p className="cell-sub">
              BOB&apos;s model calls in live runs: {calls.data.ok} of {calls.data.calls} answered
              {Object.entries(calls.data.failures).map(([cause, n]) => `; ${n} fell back to rules (${cause})`).join('')}
              {calls.data.median_ms !== null && `; median ${(calls.data.median_ms / 1000).toFixed(1)} s`}.
            </p>
          )}
          <div className="table-scroll">
            <table className="ftable ftable--compact">
              <thead>
                <tr>{['Seed', 'BOB net cost', "Today's practice", 'Saving', 'Carbon, BOB / practice', 'Violations']
                  .map((h) => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {done.map((s) => (
                  <tr key={s.seed}>
                    <td><strong>{s.seed}</strong></td>
                    <td>{inr(s.bob!.cost_inr)}</td>
                    <td>{inr(s.baseline!.cost_inr)}</td>
                    <td className={s.saving_inr! >= 0 ? 'text-success' : 'text-error'}>{inr(s.saving_inr!)}</td>
                    <td>{s.bob!.carbon_t.toFixed(1)} / {s.baseline!.carbon_t.toFixed(1)} t</td>
                    <td>{s.violations.length || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

const boxOptions = (title: string): BoxplotChartOptions => ({
  title,
  height: '220px',
  axes: {
    left: { mapsTo: 'group', scaleType: ScaleTypes.LABELS },
    bottom: { mapsTo: 'value' },
  },
  color: { scale: { BOB: SERIES.bob, "Today's practice": SERIES.baseline } },
  legend: { enabled: false },
  toolbar: { enabled: false },
})
