import { useQuery } from '@tanstack/react-query'
import {
  ComboChart,
  ScaleTypes,
  type AreaChartOptions,
  type ComboChartOptions,
  type LineChartOptions,
} from '@carbon/charts-react'
import { InlineNotification, ProgressBar, SkeletonText, Tile } from '@carbon/react'
import type { RunState, SiteLive } from '../api/client'
import { runApi } from '../api/client'
import { mw, simTime } from '../format'
import { SERIES } from '../theme/tokens'

interface Props {
  run: RunState
  siteCode: string
  generationSeries: 'solar' | 'wind'
}

export function LiveOverview({ run, siteCode, generationSeries }: Props) {
  const { data, error } = useQuery({
    queryKey: ['live', run.id, siteCode, run.block],
    queryFn: () => runApi.siteLive(run.id, siteCode),
    enabled: run.block >= 0,
  })

  if (run.block < 0) return <SkeletonText paragraph lineCount={4} />
  if (error) return <InlineNotification kind="error" title="Could not load live data" subtitle={error.message} hideCloseButton lowContrast />
  if (!data) return <SkeletonText paragraph lineCount={8} />

  const w = data.weather
  const weather = [
    ['Condition', w.condition],
    ['Irradiance', `${w.irradiance_wm2} W/m²`],
    ['Cloud cover', `${w.cloud_pct} %`],
    ['Wind speed', `${w.wind_ms} m/s`],
    ['Temperature', `${w.temperature_c} °C`],
    ['Grid frequency', `${w.frequency_hz.toFixed(2)} Hz`],
  ]

  return (
    <div className="live">
      <Tile className="live__weather">
        {weather.map(([label, value]) => (
          <div key={label}>
            <div className="stat-label">{label}</div>
            <div className="live__weather-value">{value}</div>
          </div>
        ))}
      </Tile>

      {data.alerts.map((a) => (
        <InlineNotification key={a.title} kind={a.severity} title={a.title} subtitle={a.detail} hideCloseButton lowContrast />
      ))}

      <div className="card-grid">
        {data.generation && (
          <Tile>
            <div className="stat-label">Generation</div>
            <div className="stat-value">{mw(data.generation.actual_mw)}</div>
            <ProgressBar
              label={`${Math.round((data.generation.actual_mw / data.generation.capacity_mw) * 100)} % of ${mw(data.generation.capacity_mw)}`}
              value={data.generation.actual_mw}
              max={data.generation.capacity_mw}
              size="small"
            />
            <div className="stat-label">
              {data.generation.forecast_mw === null
                ? 'No forecast an hour ago'
                : `Forecast an hour ago: ${mw(data.generation.forecast_mw)}`}
            </div>
          </Tile>
        )}
        {data.batteries.map((b) => (
          <Tile key={b.code}>
            <div className="stat-label">{b.name}</div>
            <div className="stat-value">{b.soc_pct} %</div>
            <ProgressBar label={`${b.energy_mwh} MWh · ${mw(b.power_mw)}`} value={b.soc_pct} max={100} size="small" />
            <div className="stat-label">{b.available ? 'Idle' : 'Unavailable'}</div>
          </Tile>
        ))}
        {data.demand_mw !== null && (
          <Tile>
            <div className="stat-label">Local demand</div>
            <div className="stat-value">{mw(data.demand_mw)}</div>
          </Tile>
        )}
        {data.grid_mw !== null && (
          <Tile>
            <div className="stat-label">Grid</div>
            <div className="stat-value">{mw(Math.abs(data.grid_mw))}</div>
            <div className="stat-label">{data.grid_mw >= 0 ? 'Importing' : 'Exporting'}</div>
          </Tile>
        )}
      </div>

      <Tile>
        <div className="card-title">Balance statement</div>
        <p className="page-meta">{balance(data)}</p>
      </Tile>

      <Tile>
        <div className="card-title">Live generation and forecast</div>
        <ComboChart data={chartData(data)} options={chartOptions(data, generationSeries)} />
      </Tile>

      <Tile>
        <div className="card-title">Energy flow · as of {simTime(data.as_of)} IST</div>
        <div className="live__flow">
          <FlowList title="Sources" items={data.sources} />
          <FlowList title="Uses" items={data.uses} />
        </div>
      </Tile>
    </div>
  )
}

function FlowList({ title, items }: { title: string; items: SiteLive['sources'] }) {
  const max = Math.max(1, ...items.map((i) => i.mw))
  return (
    <div>
      <div className="stat-label">{title}</div>
      {items.map((i) => (
        <ProgressBar key={i.label} label={i.label} helperText={mw(i.mw)} value={i.mw} max={max} size="small" />
      ))}
    </div>
  )
}

function balance(data: SiteLive): string {
  const part = (items: SiteLive['sources']) =>
    items.filter((i) => i.mw > 0).map((i) => `${i.label.toLowerCase()} ${mw(i.mw)}`).join(' + ') || 'nothing'
  const text = `${part(data.sources)} = ${part(data.uses)}.`
  return text.charAt(0).toUpperCase() + text.slice(1)
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
      { type: 'line', correspondingDatasets: ['Actual generation', 'Forecast', 'Demand'] },
    ],
    color: {
      scale: {
        'Actual generation': SERIES[generationSeries],
        Forecast: SERIES[generationSeries],
        'Forecast range': SERIES[generationSeries],
        Demand: SERIES.demand,
      },
    },
    timeScale: { addSpaceOnEdges: 0 },
  }
}
