import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ComboChart,
  ScaleTypes,
  type AreaChartOptions,
  type ComboChartOptions,
  type LineChartOptions,
} from '@carbon/charts-react'
import { InlineNotification, SkeletonText } from '@carbon/react'
import {
  Activity,
  BatteryCharging,
  Building,
  Cloudy,
  InformationFilled,
  Light,
  PartlyCloudy,
  Plug,
  Sun,
  Temperature,
  Time,
  WarningFilled,
  WindPower,
  Windy,
} from '@carbon/icons-react'
import type { RunState, SiteLive } from '../api/client'
import { portfolioApi, runApi, siteApi } from '../api/client'
import { batteryState, mw, sentence, simTime } from '../format'
import { SERIES } from '../theme/tokens'

interface Props {
  run: RunState
  siteCode: string
  generationSeries: 'solar' | 'wind'
}

const SEVERITY_ICON = { info: InformationFilled, warning: WarningFilled, error: WarningFilled }
const FLOW_COLOUR: Record<string, string> = {
  'Battery discharge': SERIES.battery,
  'Grid import': SERIES.grid,
  'Local demand': SERIES.demand,
  'Battery charging': SERIES.battery,
  'Sent to the network': SERIES.grid,
}

export function LiveOverview({ run, siteCode, generationSeries }: Props) {
  const { data, error } = useQuery({
    queryKey: ['live', run.id, siteCode, run.block],
    queryFn: () => runApi.siteLive(run.id, siteCode),
    enabled: run.block >= 0,
  })
  const sources = useQuery({ queryKey: ['sources', siteCode], queryFn: () => siteApi.sources(siteCode) })
  const floor = useQuery({ queryKey: ['portfolio'], queryFn: portfolioApi.get }).data?.protected.battery_soc_floor_pct

  if (run.block < 0) return <SkeletonText paragraph lineCount={4} />
  if (error) return <InlineNotification kind="error" title="Could not load live data" subtitle={error.message} hideCloseButton lowContrast />
  if (!data) return <SkeletonText paragraph lineCount={8} />

  const w = data.weather
  const gen = data.generation
  const GenIcon = generationSeries === 'solar' ? Sun : WindPower
  const colours = { ...FLOW_COLOUR, Generation: SERIES[generationSeries] }
  const gap = gen?.forecast_mw != null ? gen.forecast_mw - gen.actual_mw : null
  const peak = Math.max(0, ...data.chart.filter((p) => p.group === 'Actual generation').map((p) => p.value))
  const supplied = data.sources.reduce((sum, f) => sum + f.mw, 0)
  const renewable = supplied ? Math.round((100 * (data.sources.find((f) => f.label === 'Generation')?.mw ?? 0)) / supplied) : 0
  const feeds = ['Simulated telemetry · every 15 minutes', ...(sources.data ?? []).map((s) => `${s.name} · ${s.kind === 'csv' ? 'imported CSV' : 'API'}`)]
  const conditions = [
    ['Cloud cover', `${w.cloud_pct}%`],
    ['Irradiance', `${w.irradiance_wm2} W/m²`],
    ['Temperature', `${w.temperature_c}°C`],
    ['Wind', `${w.wind_ms} m/s`],
  ]

  return (
    <div className="stack">
      <div className="weather">
        {[
          { Icon: w.cloud_pct < 50 ? PartlyCloudy : Cloudy, label: 'Condition', value: w.condition },
          { Icon: Light, label: 'Irradiance', value: `${w.irradiance_wm2} W/m²` },
          { Icon: Cloudy, label: 'Cloud cover', value: `${w.cloud_pct}%` },
          { Icon: Windy, label: 'Wind speed', value: `${w.wind_ms} m/s` },
          { Icon: Temperature, label: 'Temperature', value: `${w.temperature_c}°C` },
          { Icon: Activity, label: 'Grid frequency', value: `${w.frequency_hz.toFixed(2)} Hz` },
          { Icon: Time, label: 'Last updated', value: `${simTime(data.as_of)} IST` },
        ].map(({ Icon, label, value }) => (
          <div key={label}>
            <Icon size={16} />
            <span className="weather__label">{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      <div className="metric-grid">
        {gen && (
          <Metric icon={<GenIcon size={16} />} title={`${sentence(generationSeries)} generation`}
            note={`${Math.round((100 * gen.actual_mw) / gen.capacity_mw)}% of capacity`} noteClass="text-success"
            value={mw(gen.actual_mw)} fill={gen.actual_mw / gen.capacity_mw}
            foot={gen.forecast_mw === null ? 'No forecast an hour ago'
              : `Forecast ${mw(gen.forecast_mw)} · ${mw(Math.abs(gap!))} ${gap! > 0 ? 'below' : 'above'} forecast`} />
        )}
        {data.demand_mw !== null && (
          <Metric icon={<Building size={16} />} title="Local demand" value={mw(data.demand_mw)} foot="Industrial and site load at this point" />
        )}
        {data.batteries.map((b) => (
          <Metric key={b.code} icon={<BatteryCharging size={16} />} title={b.name}
            note={batteryState(b.mw, b.available)} noteClass="text-caution"
            value={`${b.soc_pct}%`} fill={b.soc_pct / 100}
            foot={`${b.energy_mwh} MWh · ${mw(b.power_mw)}${floor !== undefined ? ` · reserve ${floor}%` : ''}`} />
        ))}
        {data.grid_mw !== null && (
          <Metric icon={<Plug size={16} />} title="Grid" noteClass="text-interactive"
            note={data.grid_mw > 0.05 ? 'Importing' : data.grid_mw < -0.05 ? 'Exporting' : 'No exchange'}
            value={`${mw(Math.abs(data.grid_mw))} ${data.grid_mw >= 0 ? 'import' : 'export'}`} foot="Connected to the grid" />
        )}
      </div>

      <section className="panel panel--padded">
        <h2 className="panel__title panel__title--small">Balance statement</h2>
        <p className="rec__text">{balance(data)}</p>
      </section>

      {data.alerts.map((a) => {
        const Icon = SEVERITY_ICON[a.severity]
        return (
          <div key={a.title} className={`callout callout--${a.severity}`}>
            <Icon size={20} />
            <div><strong>{a.title}</strong><p>{a.detail}</p></div>
          </div>
        )
      })}
      <div className="callout callout--info">
        <InformationFilled size={20} />
        <div>
          <strong>What BOB is doing</strong>
          <p>{data.bob_now.length ? `This block: ${data.bob_now.join('; ')}.` : 'This block: holding, no change at this site.'}</p>
        </div>
      </div>

      <section className="panel panel--padded">
        <div className="panel__head">
          <h2 className="panel__title">Live generation, forecast and BOB's battery plan</h2>
          <div className="chip-row chip-row--tight">
            {data.alerts.length > 0 && <span className="badge badge--amber">{data.alerts.length} alerts</span>}
            <span className="badge badge--green">{feeds.length} {feeds.length === 1 ? 'source' : 'sources'} live</span>
            <span className="cell-sub">As of {simTime(data.as_of)} IST</span>
          </div>
        </div>
        <ComboChart data={chartData(data)} options={chartOptions(data, generationSeries)} />
        {gen && (
          <div className="legend-grid">
            <LegendStat colour={SERIES[generationSeries]} label="Current" value={mw(gen.actual_mw)} />
            <LegendStat colour={SERIES.forecast} label="Forecast" value={gen.forecast_mw === null ? '—' : mw(gen.forecast_mw)} />
            <LegendStat colour={SERIES.price} label={gap !== null && gap < 0 ? 'Above forecast' : 'Shortfall'}
              value={gap === null ? '—' : mw(Math.abs(gap))} />
            <LegendStat colour={SERIES.grid} label="Peak, last 12 h" value={mw(peak)} />
          </div>
        )}
        <div className="two-col two-col--ruled">
          <div>
            <h3 className="subhead">Conditions affecting generation</h3>
            <dl className="kv kv--compact">
              {conditions.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
            </dl>
            <h3 className="subhead">Data sources</h3>
            <ul className="checklist checklist--small">
              {feeds.map((f) => <li key={f}><span className="dot dot--green" />{f}</li>)}
            </ul>
            <Link to={`/sites/${siteCode}/data`} className="text-link">View connections</Link>
          </div>
          <div>
            <h3 className="subhead"><span className="dot dot--warning" />Active alerts</h3>
            {data.alerts.length === 0 && <p className="cell-sub">No active alerts.</p>}
            {data.alerts.map((a) => <p key={a.title} className="alert-line">{a.title}: {a.detail}</p>)}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel__head panel--padded">
          <h2 className="panel__title">Energy flow</h2>
          <span className="badge badge--green">Simulated</span>
        </div>
        <div className="two-col panel--padded flow">
          <FlowList title="Sources" items={data.sources} colours={colours} />
          <FlowList title="Uses" items={data.uses} colours={colours} />
        </div>
        <div className="flow__foot">
          Renewable share <strong className="text-success">{renewable}%</strong>
          <span className="ring" />
        </div>
      </section>

      {data.batteries.map((b) => {
        const stored = (b.soc_pct / 100) * b.energy_mwh
        const reserve = floor === undefined ? null : (floor / 100) * b.energy_mwh
        return (
          <section key={b.code} className="panel panel--padded">
            <div className="panel__head">
              <h2 className="panel__title panel__title--small">Battery storage · {b.name}</h2>
              <span className="cell-sub">{b.soc_pct}% charged</span>
            </div>
            <div className="kv-line"><span>Available capacity</span><strong className="text-interactive">{b.soc_pct}%</strong></div>
            <div className="meter meter--big">
              <div className="meter__fill" style={{ width: `${b.soc_pct}%` }} />
              {floor !== undefined && <span className="meter__mark" style={{ left: `${floor}%` }} />}
            </div>
            <dl className="kv kv--compact kv--plain">
              <div><dt>Total capacity</dt><dd>{b.energy_mwh} MWh · {mw(b.power_mw)}</dd></div>
              <div><dt>Stored energy</dt><dd>{stored.toFixed(1)} MWh</dd></div>
              {reserve !== null && <div><dt>Reserve limit</dt><dd className="text-error">{floor}% ({reserve.toFixed(1)} MWh)</dd></div>}
              {reserve !== null && <div><dt>Usable</dt><dd>{Math.max(0, stored - reserve).toFixed(1)} MWh</dd></div>}
              <div><dt>Current action</dt><dd className="text-caution">{batteryState(b.mw, b.available)}</dd></div>
            </dl>
          </section>
        )
      })}
    </div>
  )
}

interface MetricProps {
  icon: ReactNode
  title: string
  note?: string
  noteClass?: string
  value: string
  fill?: number
  foot: string
}

function Metric({ icon, title, note, noteClass, value, fill, foot }: MetricProps) {
  return (
    <div className="panel metric">
      <div className="metric__head">
        <span className="metric__title">{icon}{title}</span>
        {note && <span className={`metric__note ${noteClass ?? ''}`}>{note}</span>}
      </div>
      <div className="metric__value">{value}</div>
      {fill !== undefined && <div className="meter"><div className="meter__fill meter__fill--warm" style={{ width: `${Math.min(100, fill * 100)}%` }} /></div>}
      <div className="cell-sub">{foot}</div>
    </div>
  )
}

function LegendStat({ colour, label, value }: { colour: string; label: string; value: string }) {
  return (
    <div className="legend-stat">
      <span className="dot" style={{ background: colour }} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function FlowList({ title, items, colours }: { title: string; items: SiteLive['sources']; colours: Record<string, string> }) {
  const total = items.reduce((sum, i) => sum + i.mw, 0)
  return (
    <div>
      <h3 className="subhead">{title}</h3>
      {items.map((i) => (
        <div key={i.label} className="flow__item">
          <div className="kv-line"><span><span className="dot" style={{ background: colours[i.label] }} />{i.label}</span><strong>{mw(i.mw)}</strong></div>
          <div className="meter meter--thin">
            <div className="meter__fill" style={{ width: `${total ? (100 * i.mw) / total : 0}%`, background: colours[i.label] }} />
          </div>
        </div>
      ))}
      <div className="kv-line"><span>Total</span><strong>{mw(total)}</strong></div>
    </div>
  )
}

function balance(data: SiteLive): string {
  const part = (items: SiteLive['sources']) =>
    items.filter((i) => i.mw > 0).map((i) => `${i.label.toLowerCase()} ${mw(i.mw)}`).join(' + ') || 'nothing'
  return sentence(`${part(data.sources)} = ${part(data.uses)}.`)
}

function chartData(data: SiteLive) {
  return data.chart.flatMap((p) => {
    const point = { group: p.group, date: new Date(p.time), value: p.value }
    return p.low === null ? [point] : [point, { ...point, group: 'Forecast range', min: p.low, max: p.high }]
  })
}

type ChartOptions = ComboChartOptions & AreaChartOptions & LineChartOptions

function chartOptions(data: SiteLive, generationSeries: 'solar' | 'wind'): ChartOptions {
  return {
    height: '320px',
    // Carbon Charts reads bounds and points from the top level, even inside a combo chart.
    bounds: { upperBoundMapsTo: 'max', lowerBoundMapsTo: 'min' },
    points: { enabled: false },
    legend: { truncation: { numCharacter: 40 } },
    toolbar: { enabled: false },
    axes: {
      bottom: {
        mapsTo: 'date',
        scaleType: ScaleTypes.TIME,
        thresholds: [{ value: new Date(data.sim_time), label: 'Now' }],
      },
      left: { mapsTo: 'value', title: 'MW' },
    },
    comboChartTypes: [
      { type: 'area', correspondingDatasets: ['Forecast range'] },
      { type: 'line', correspondingDatasets: ['Actual generation', 'Forecast', 'Demand', 'Planned battery'] },
    ],
    color: {
      scale: {
        'Actual generation': SERIES[generationSeries],
        Forecast: SERIES.forecast,
        'Forecast range': SERIES.forecast,
        Demand: SERIES.demand,
        'Planned battery': SERIES.battery,
      },
    },
    timeScale: { addSpaceOnEdges: 0 },
  }
}
