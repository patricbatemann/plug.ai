import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ComboChart, ScaleTypes, type AreaChartOptions, type ComboChartOptions, type LineChartOptions } from "@carbon/charts-react";
import "@carbon/charts-react/styles.css";
import BobToggle from "./BobToggle";
import LiveFeed from "./LiveFeed";
import { portfolioApi, siteApi, type FlowItem, type SiteLive } from "./api/client";
import { SITE } from "./data";
import { batteryState, kindLabel, mw, mwh, simDateTime } from "./format";
import { useSite } from "./site";

const assetPathPrefix = '/assets';
const imgIconSun = `${assetPathPrefix}/31b52.svg`;
const imgIconBot = `${assetPathPrefix}/8be4b.svg`;
const imgEllipse5 = `${assetPathPrefix}/71d6b.svg`;

const SERIES: Record<string, string> = {
  'Actual generation': '#b26207', Forecast: '#8d8d8d', 'Forecast range': '#8d8d8d', Demand: '#161616', 'Planned battery': '#0f62fe',
};
const FLOW_COLORS = ['#b26207', '#198038', '#0f62fe', '#525252'];

interface LiveOverviewProps {
  onBack: () => void;
  onTabChange?: (tab: string) => void;
  onBob?: () => void;
  onConnectData: () => void;
}

const text = (extra: string) => ({ className: `font-['IBM Plex Sans'] ${extra}`, style: { fontVariationSettings: '"wdth" 100' } });

function Metric({ title, note, value, children }: { title: string; note?: string; value: string; children?: ReactNode }) {
  return (
    <div className="bg-white border border-[#e0e0e0] flex flex-1 flex-col gap-4 items-start min-w-0 p-5 rounded-[2px]">
      <div className="flex flex-wrap gap-3 items-center justify-between w-full">
        <p {...text('font-medium text-[#525252] text-[13px]')}>{title}</p>
        {note && <p className="font-mono font-semibold text-[#198038] text-[12px]">{note}</p>}
      </div>
      <p className="font-mono font-bold text-[#161616] text-[28px]">{value}</p>
      {children}
    </div>
  );
}

function Bars({ title, items }: { title: string; items: FlowItem[] }) {
  const total = items.reduce((sum, item) => sum + Math.abs(item.mw), 0);
  return (
    <div className="flex flex-1 flex-col gap-3 items-start min-w-0">
      <p {...text('font-semibold text-[#525252] text-[13px]')}>{title}</p>
      {items.map((item, i) => (
        <div key={item.label} className="flex flex-col gap-1.5 w-full">
          <div className="flex flex-wrap gap-3 items-center justify-between w-full">
            <div className="flex gap-2 items-center">
              <div className="rounded-[2px] shrink-0 size-2" style={{ backgroundColor: FLOW_COLORS[i % FLOW_COLORS.length] }} />
              <p {...text('text-[#525252] text-[13px]')}>{item.label}</p>
            </div>
            <p className="font-mono font-semibold text-[#161616] text-[13px]">{mw(Math.abs(item.mw))}</p>
          </div>
          <div className="bg-[#f4f4f4] flex h-1.5 overflow-hidden rounded-[2px] w-full">
            <div className="h-1.5 rounded-[2px]" style={{ width: `${total ? (Math.abs(item.mw) / total) * 100 : 0}%`, backgroundColor: FLOW_COLORS[i % FLOW_COLORS.length] }} />
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-3 items-center justify-between w-full">
        <p {...text('text-[#525252] text-[13px]')}>Total</p>
        <p className="font-mono font-bold text-[#161616] text-[13px]">{mw(total)}</p>
      </div>
    </div>
  );
}

const sentence = (items: FlowItem[]) => items.filter((i) => Math.abs(i.mw) >= 0.05).map((i) => `${i.label} ${mw(Math.abs(i.mw))}`).join(' + ') || '0 MW';

function chartData(live: SiteLive) {
  return live.chart.flatMap((p) => {
    const point = { group: p.group, date: new Date(p.time), value: p.value };
    return p.low == null ? [point] : [point, { ...point, group: 'Forecast range', min: p.low, max: p.high }];
  });
}

function chartOptions(live: SiteLive): ComboChartOptions & AreaChartOptions & LineChartOptions {
  // Carbon warns about a named dataset with no points, and a site may have no demand or forecast range.
  const groups = new Set(chartData(live).map((p) => p.group));
  const present = (names: string[]) => names.filter((name) => groups.has(name));
  return {
    height: '260px',
    // Carbon Charts reads bounds and points from the top level, even inside a combo chart.
    bounds: { upperBoundMapsTo: 'max', lowerBoundMapsTo: 'min' },
    points: { enabled: false },
    legend: { truncation: { numCharacter: 40 } },
    toolbar: { enabled: false },
    axes: {
      bottom: { mapsTo: 'date', scaleType: ScaleTypes.TIME, thresholds: [{ value: new Date(live.sim_time), label: 'Now' }] },
      left: { mapsTo: 'value', title: 'MW' },
    },
    comboChartTypes: [
      { type: 'area', correspondingDatasets: present(['Forecast range']) },
      { type: 'line', correspondingDatasets: present(['Actual generation', 'Forecast', 'Demand', 'Planned battery']) },
    ],
    color: { scale: Object.fromEntries(present(Object.keys(SERIES)).map((name) => [name, SERIES[name]])) },
    timeScale: { addSpaceOnEdges: 0 },
  };
}

export default function LiveOverview({ onBack, onTabChange, onBob, onConnectData }: LiveOverviewProps) {
  const { live, battery, reservePct, bobActive } = useSite();
  const detail = useQuery({ queryKey: ['site', SITE.id], queryFn: () => portfolioApi.site(SITE.id) }).data;
  const sources = useQuery({ queryKey: ['data-sources', SITE.id], queryFn: () => siteApi.sources(SITE.id) }).data ?? [];
  const generation = live?.generation;
  const deviation = generation?.forecast_mw != null ? generation.actual_mw - generation.forecast_mw : null;
  const usable = battery && reservePct !== null ? Math.max(0, ((battery.soc_pct - reservePct) / 100) * battery.energy_mwh) : null;

  return (
    <div className="bg-[#f4f4f4] min-h-screen w-full">
      <header className="bg-white border-b border-[#e0e0e0] flex flex-wrap gap-3 items-center justify-between min-h-12 py-3 px-4 md:px-6 top-0 z-20">
        <div className="flex gap-6 items-center max-sm:flex-wrap">
          <div className="flex gap-2 items-center">
            <img alt="" className="size-6" src={imgEllipse5} />
            <p {...text('font-semibold text-[#161616] text-[16px]')}>{SITE.name}</p>
          </div>
          <nav className="flex gap-6 items-center">
            <div className="flex flex-col gap-1 items-center">
              <p {...text('font-semibold text-[#0f62fe] text-[13px]')}>Site</p>
              <div className="bg-[#0f62fe] h-0.5 w-6" />
            </div>
            <button onClick={onBob} {...text('font-medium text-[#525252] text-[13px] cursor-pointer hover:text-[#161616]')}>BOB</button>
          </nav>
        </div>
      </header>

      <div className="bg-white border-b border-[#e0e0e0] flex flex-col gap-3 px-6 py-4">
        <div className="flex gap-2 items-center max-sm:flex-wrap">
          <button onClick={onBack} {...text('text-[#525252] text-[13px] hover:text-[#0f62fe]')}>Sites</button>
          <p className="text-[#8d8d8d] text-[13px]">/</p>
          <button onClick={onBack} {...text('text-[#525252] text-[13px] hover:text-[#0f62fe]')}>{SITE.name}</button>
          <p className="text-[#8d8d8d] text-[13px]">/</p>
          <p {...text('text-[#525252] text-[13px]')}>Live overview</p>
        </div>
        <div className="flex flex-col lg:flex-row gap-4 items-start justify-between">
          <div className="flex flex-col gap-2 flex-1 min-w-0">
            <div className="flex gap-3 items-center max-sm:flex-wrap">
              <div className="bg-[#fef8ed] flex items-center justify-center rounded-[2px] size-8 shrink-0">
                <img alt="" className="size-6" src={imgIconSun} />
              </div>
              <p {...text('font-bold text-[#161616] text-[24px]')}>
                {SITE.name} · <span className="font-mono text-[#525252] font-semibold">{SITE.id}</span>
              </p>
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              {detail && <span className="bg-[#f4f4f4] border border-[#e0e0e0] px-2 py-0.5 rounded-[2px] text-[12px] font-semibold text-[#525252]">{kindLabel(detail.kind)}</span>}
              {generation && (
                <span className="bg-[#f4f4f4] border border-[#e0e0e0] px-2 py-0.5 rounded-[2px] text-[12px] font-semibold text-[#525252]">
                  <span className="font-mono">{mw(generation.capacity_mw)}</span>{battery && <> · <span className="font-mono">{battery.soc_pct}%</span> SOC</>}
                </span>
              )}
            </div>
            <p {...text('text-[#525252] text-[14px]')}>
              {SITE.location}{detail && <> · Commissioned {new Date(detail.commissioned_on).getFullYear()}</>}{live && <> · As of <span className="font-mono text-[#161616]">{simDateTime(live.as_of)} IST</span></>}
            </p>
          </div>
          <div className="flex gap-3 items-center w-full lg:w-auto min-w-0 flex-wrap lg:justify-end">
            <div className="bg-[#f4f0ff] border border-[#d4bbff] flex gap-1.5 items-center px-2 py-1 rounded-[2px]">
              <img alt="" className="size-4" src={imgIconBot} />
              <p {...text('font-semibold text-[#8a3ffc] text-[12px]')}>{bobActive ? 'BOB active' : 'BOB paused'}</p>
            </div>
            {detail && <span className="bg-[#f4f4f4] border border-[#e0e0e0] px-2 py-1 rounded-[2px] text-[12px] font-semibold text-[#525252]">Mode: {detail.mode_code.replace(/_/g, ' ')}</span>}
            <BobToggle />
            <button onClick={onBob} className="bg-[#0f62fe] px-4 py-2 rounded-[2px] cursor-pointer hover:bg-[#0043ce] transition-colors">
              <p {...text('font-semibold text-white text-[13px]')}>Configure Actions</p>
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border-b border-[#e0e0e0] flex gap-8 items-center h-12 overflow-x-auto px-4 md:px-6 shrink-0">
        {[{ label: 'Site Details', active: false }, { label: 'Live overview', active: true }].map(({ label, active }) => (
          <button key={label} className="flex min-h-11 shrink-0 flex-col justify-center gap-1 items-center cursor-pointer"
            onClick={() => { if (label === 'Site Details') onBack(); else onTabChange?.(label); }}>
            <p {...text(`${active ? 'font-semibold text-[#0f62fe]' : 'font-medium text-[#525252] hover:text-[#161616]'} text-[13px]`)}>{label}</p>
            <div className={`${active ? 'bg-[#0f62fe]' : 'bg-transparent'} h-0.5 w-full`} />
          </button>
        ))}
      </div>

      <LiveFeed onConnect={onConnectData} />

      {live && (
        <main className="flex flex-col gap-8 px-6 py-8 pb-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-stretch w-full">
            <Metric title="Generation" note={generation?.capacity_mw ? `${Math.round((generation.actual_mw / generation.capacity_mw) * 100)}% of capacity` : undefined} value={mw(generation?.actual_mw ?? 0)}>
              {generation?.forecast_mw != null && deviation !== null && (
                <p {...text('text-[#525252] text-[12px]')}>Forecast <span className="font-mono font-medium">{mw(generation.forecast_mw)}</span> · <span className="font-mono font-medium">{mw(Math.abs(deviation))}</span> {deviation < 0 ? 'below' : 'above'} forecast</p>
              )}
            </Metric>
            <Metric title={live.demand_mw === null ? 'Sent to the network' : 'Local demand'} value={mw(live.demand_mw ?? live.uses.find((u) => u.label === 'Sent to the network')?.mw ?? 0)}>
              <p {...text('text-[#525252] text-[12px]')}>{live.demand_mw === null ? 'This site has no local load; its power serves the portfolio.' : 'Served from the sources on the left.'}</p>
            </Metric>
            {battery && (
              <Metric title={battery.name} value={`${battery.soc_pct}%`}>
                <p {...text('text-[#525252] text-[12px]')}>{batteryState(battery.mw, battery.available)}{reservePct !== null && <> · reserve <span className="font-mono">{reservePct}%</span></>}</p>
              </Metric>
            )}
            <Metric title="Grid" value={`${mw(Math.abs(live.grid_mw ?? 0))} ${(live.grid_mw ?? 0) < 0 ? 'export' : 'import'}`}>
              <p {...text('text-[#525252] text-[12px]')}>{live.connected ? 'Telemetry connected' : 'Telemetry not connected'}</p>
            </Metric>
          </div>

          <div className="bg-white border border-[#e0e0e0] flex flex-col gap-2 items-start p-4 rounded-[2px] w-full">
            <p {...text('font-semibold text-[#161616] text-[14px]')}>Balance statement</p>
            <p {...text('text-[#525252] text-[13px]')}>{sentence(live.sources)} = {sentence(live.uses)}.</p>
          </div>

          {live.alerts.map((alert) => (
            <div key={alert.title} className={`${alert.severity === 'error' ? 'bg-[#fff1f1] border-[#da1e28]' : 'bg-[#fef8ed] border-[#f8b84e]'} border flex gap-3 items-center p-4 rounded-[2px] w-full`}>
              <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                <p {...text('font-semibold text-[#161616] text-[14px]')}>{alert.title}</p>
                <p {...text('text-[#525252] text-[13px]')}>{alert.detail}</p>
              </div>
            </div>
          ))}

          <div className="bg-white border border-[#e0e0e0] flex flex-col gap-5 items-start p-6 rounded-[2px] w-full">
            <div className="flex flex-wrap gap-3 items-center justify-between w-full">
              <p {...text('font-semibold text-[#161616] text-[16px]')}>Live generation and demand</p>
              <div className="flex gap-3 items-center">
                {live.alerts.length > 0 && <span className="bg-[#fef3c7] border border-[#fde68a] px-2 py-0.5 rounded-[2px] text-[12px] font-semibold text-[#b26207]">{live.alerts.length} alert{live.alerts.length > 1 ? 's' : ''}</span>}
                <span className="bg-[#defbe6] border border-[#a7f0ba] px-2 py-0.5 rounded-[2px] text-[12px] font-semibold text-[#198038]">{sources.length} source{sources.length === 1 ? '' : 's'}</span>
              </div>
            </div>
            <div className="w-full"><ComboChart data={chartData(live)} options={chartOptions(live)} /></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start w-full">
              <div className="flex flex-col gap-2 min-w-0">
                <p {...text('font-semibold text-[#161616] text-[13px]')}>Conditions affecting generation</p>
                {[
                  ['Condition', live.weather.condition],
                  ['Cloud cover', `${live.weather.cloud_pct}%`],
                  ['Irradiance', `${live.weather.irradiance_wm2} W/m²`],
                  ['Ambient', `${live.weather.temperature_c} °C`],
                ].map(([label, value]) => (
                  <div key={label} className="border-b border-[#e0e0e0] flex flex-wrap gap-3 items-center justify-between pb-2 w-full">
                    <p {...text('text-[#525252] text-[13px]')}>{label}</p>
                    <p className="font-mono font-medium text-[#161616] text-[13px]">{value}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-2 min-w-0">
                <p {...text('font-semibold text-[#161616] text-[13px]')}>Data sources</p>
                {sources.length === 0 && <p {...text('text-[#525252] text-[12px]')}>No data source is connected.</p>}
                {sources.map((s) => (
                  <p key={s.id} {...text('text-[#525252] text-[12px] break-all')}>{s.kind === 'api' ? 'Live API' : 'CSV'} · {s.name}{s.rows !== null && <> · <span className="font-mono">{s.rows}</span> rows</>}</p>
                ))}
                <button onClick={onConnectData} {...text('font-semibold text-[#0f62fe] text-[12px] underline cursor-pointer self-start')}>Connect data</button>
              </div>
            </div>
          </div>

          <div className="bg-white border border-[#e0e0e0] flex flex-col gap-6 items-start p-6 rounded-[2px] w-full">
            <p {...text('font-semibold text-[#161616] text-[16px]')}>Energy flow</p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start w-full">
              <Bars title="Sources" items={live.sources} />
              <Bars title="Uses" items={live.uses} />
            </div>
          </div>

          {battery && (
            <div className="bg-white border border-[#e0e0e0] flex flex-col gap-5 items-start p-6 rounded-[2px] w-full">
              <div className="flex flex-wrap gap-3 items-center justify-between w-full">
                <p {...text('font-semibold text-[#161616] text-[16px]')}>Battery storage</p>
                <p className="font-mono text-[#8d8d8d] text-[13px]">{battery.soc_pct}% charged</p>
              </div>
              <div className="bg-[#f4f4f4] flex h-6 overflow-hidden relative rounded-[2px] w-full">
                <div className="bg-[#198038] h-6" style={{ width: `${battery.soc_pct}%` }} />
                {reservePct !== null && <div className="absolute bg-[#b26207] h-6 top-0" style={{ left: `${reservePct}%`, width: '2px' }} />}
              </div>
              <div className="flex flex-col gap-2.5 w-full">
                {[
                  ['Total capacity', mwh(battery.energy_mwh)],
                  ['Stored energy', mwh((battery.soc_pct / 100) * battery.energy_mwh)],
                  ['Reserve limit', reservePct === null ? '—' : `${reservePct}% (${mwh((reservePct / 100) * battery.energy_mwh)})`],
                  ['Usable above reserve', usable === null ? '—' : mwh(usable)],
                  ['Current action', batteryState(battery.mw, battery.available)],
                ].map(([label, value]) => (
                  <div key={label} className="flex flex-wrap gap-3 items-center justify-between w-full">
                    <p {...text('text-[#525252] text-[13px]')}>{label}</p>
                    <p className="font-mono font-medium text-[#161616] text-[13px]">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      )}
    </div>
  );
}
