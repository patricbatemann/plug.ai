import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { BoxplotChart, ScaleTypes, type BoxplotChartOptions } from '@carbon/charts-react'
import {
  Button, FilterableMultiSelect, InlineNotification, NumberInput, ProgressBar, Select, SelectItem, SkeletonText,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tag, Tile,
} from '@carbon/react'
import { portfolioApi, runApi, simulationApi, type Study, type WhatIfChange } from '../api/client'
import { inr, MODES, modeLabel, simTime } from '../format'
import { useCurrentRun } from '../runs/useCurrentRun'
import { WhatIfTable } from '../runs/WhatIfTable'
import { SERIES } from '../theme/tokens'

export function SimulationPage() {
  return (
    <>
      <h1 className="page-title">Simulation</h1>
      <p className="page-meta">
        Try a change against the block in progress, or replay a scenario over many seeds to compare BOB with
        today&apos;s practice. Nothing here is sent to any asset.
      </p>
      <WhatIf />
      <Replay />
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
    <Tile className="simulation__panel">
      <h2 className="section-title">What-if</h2>
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
      <Button size="md" disabled={!run || compare.isPending} onClick={() => compare.mutate()}>
        {compare.isPending ? 'Planning…' : 'Compare plans'}
      </Button>
      {!run && <p className="stat-label">Start a run first: the what-if plans the block in progress.</p>}
      {compare.error && <InlineNotification kind="error" lowContrast hideCloseButton title={compare.error.message} />}
      {compare.data && <WhatIfTable current={compare.data.current} whatIf={compare.data.what_if} actions />}
    </Tile>
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
    <Tile className="simulation__panel">
      <h2 className="section-title">Replay: BOB vs today&apos;s practice</h2>
      <p className="stat-label">
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
      <Button size="md" disabled={start.isPending || seeds < 1 || seeds > 20} onClick={() => start.mutate()}>
        {start.isPending ? 'Starting…' : 'Start replay'}
      </Button>
      {start.error && <InlineNotification kind="error" lowContrast hideCloseButton title={start.error.message} />}
      {study.data && <StudyResult study={study.data} />}
    </Tile>
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
              <Tile key={key} className="simulation__chart">
                <BoxplotChart data={done.flatMap((s) => [
                  { group: 'BOB', value: s.bob![key as keyof typeof s.bob] },
                  { group: "Today's practice", value: s.baseline![key as keyof typeof s.baseline] },
                ])} options={boxOptions(label)} />
              </Tile>
            ))}
          </div>
          <h3 className="section-title">Reliability</h3>
          <div className="tag-row">
            <Tag type={r.hard_limit_violations ? 'red' : 'green'}>Hard-limit violations: {r.hard_limit_violations}</Tag>
            <Tag type={r.unserved_mwh.bob ? 'red' : 'green'}>Unserved energy, BOB: {r.unserved_mwh.bob} MWh</Tag>
            <Tag type="gray">Today&apos;s practice: {r.unserved_mwh.baseline} MWh</Tag>
            <Tag type={r.safe_holds ? 'warm-gray' : 'gray'}>Safe holds: {r.safe_holds}</Tag>
            <Tag type="gray">Approvals nobody answered: {r.approvals_expired}</Tag>
          </div>
          {calls.data && (
            <p className="stat-label">
              BOB&apos;s model calls in live runs: {calls.data.ok} of {calls.data.calls} answered
              {Object.entries(calls.data.failures).map(([cause, n]) => `; ${n} fell back to rules (${cause})`).join('')}
              {calls.data.median_ms !== null && `; median ${(calls.data.median_ms / 1000).toFixed(1)} s`}.
            </p>
          )}
          <Table aria-label="Replay seeds" size="sm">
            <TableHead>
              <TableRow>
                {['Seed', 'BOB net cost', "Today's practice", 'Saving', 'Carbon, BOB / practice', 'Violations']
                  .map((h) => <TableHeader key={h}>{h}</TableHeader>)}
              </TableRow>
            </TableHead>
            <TableBody>
              {done.map((s) => (
                <TableRow key={s.seed}>
                  <TableCell>{s.seed}</TableCell>
                  <TableCell>{inr(s.bob!.cost_inr)}</TableCell>
                  <TableCell>{inr(s.baseline!.cost_inr)}</TableCell>
                  <TableCell>{inr(s.saving_inr!)}</TableCell>
                  <TableCell>{s.bob!.carbon_t.toFixed(1)} / {s.baseline!.carbon_t.toFixed(1)} t</TableCell>
                  <TableCell>{s.violations.length || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
