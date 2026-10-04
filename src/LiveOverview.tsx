import { useOperations } from "./Operations";
import BobToggle from "./BobToggle";
import { getWeatherTelemetry, getGenerationConditions, getActiveAlerts, getMonitoringFeeds } from "./services/siteService";
const assetPathPrefix = '/assets';
const imgLine = `${assetPathPrefix}/be6c1.png`;
const imgLine2 = `${assetPathPrefix}/7a753.png`;
const imgIconSun = `${assetPathPrefix}/31b52.svg`;
const imgIconBot = `${assetPathPrefix}/8be4b.svg`;
const imgMoreHorizontal = `${assetPathPrefix}/05748.svg`;
const imgFrame = `${assetPathPrefix}/308b4.svg`;
const imgFrame1 = `${assetPathPrefix}/98202.svg`;
const imgFrame2 = `${assetPathPrefix}/e72ff.svg`;
const imgFrame3 = `${assetPathPrefix}/62ebc.svg`;
const imgLine1 = `${assetPathPrefix}/3a047.svg`;
const imgEllipse = `${assetPathPrefix}/0e58e.svg`;
const imgEllipse1 = `${assetPathPrefix}/26af4.svg`;
const imgEllipse2 = `${assetPathPrefix}/c2bde.svg`;
const imgEllipse3 = `${assetPathPrefix}/d5731.svg`;
const imgEllipse4 = `${assetPathPrefix}/db115.svg`;
const imgFrame4 = `${assetPathPrefix}/eb1e9.svg`;
const imgEllipse5 = `${assetPathPrefix}/71d6b.svg`;
const imgIconBell = `${assetPathPrefix}/dd0db.svg`;
const imgIconWrap = `${assetPathPrefix}/4fefd.svg`;
const imgThermometer = `${assetPathPrefix}/d323a.svg`;
const imgEllipse6 = `${assetPathPrefix}/49c35.svg`;
const imgArrowUp = `${assetPathPrefix}/2da95.svg`;
const imgWind = `${assetPathPrefix}/7c103.svg`;
const imgDroplet = `${assetPathPrefix}/5cc89.svg`;
const imgCloud = `${assetPathPrefix}/63dac.svg`;
const imgClock = `${assetPathPrefix}/d8fc8.svg`;

interface LiveOverviewProps {
  onBack: () => void;
  onTabChange?: (tab: string) => void;
  onBob?: () => void;
}

export default function LiveOverview({ onBack, onTabChange, onBob }: LiveOverviewProps) {
  const { state, flow } = useOperations();
  const weather = getWeatherTelemetry();
  const generationConditions = getGenerationConditions();
  const activeAlerts = getActiveAlerts();
  const monitoringFeeds = getMonitoringFeeds();

  return (
    <div className="bg-[#f4f4f4] min-h-screen w-full">
      {/* Global Header */}
      <header className="bg-white border-b border-[#e0e0e0] flex flex-wrap gap-3 items-center justify-between min-h-12 py-3 px-4 md:px-6 top-0 z-20">
        <div className="flex gap-6 items-center max-sm:flex-wrap">
          <div className="flex gap-2 items-center max-sm:flex-wrap">
            <div className="size-6 relative shrink-0">
              <img alt="" className="absolute inset-0 size-full" src={imgEllipse5} />
            </div>
            <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#161616] text-[16px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Kuppam Solar</p>
          </div>
          <nav className="flex gap-6 items-center max-sm:flex-wrap">
            <div className="flex flex-col gap-1 items-center">
              <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#0f62fe] text-[13px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Site</p>
              <div className="bg-[#0f62fe] h-0.5 w-6" />
            </div>
            <p onClick={onBob} className="font-['IBM Plex Sans:Medium'] font-medium text-[#525252] text-[13px] leading-normal whitespace-nowrap max-sm:whitespace-normal cursor-pointer hover:text-[#161616] transition-colors" style={{ fontVariationSettings: '"wdth" 100' }}>BOB</p>
            <p className="font-['IBM Plex Sans:Medium'] font-medium text-[#525252] text-[13px] leading-normal whitespace-nowrap max-sm:whitespace-normal cursor-pointer hover:text-[#161616] transition-colors" style={{ fontVariationSettings: '"wdth" 100' }}>Settings</p>
          </nav>
        </div>
        <div className="flex gap-4 items-center max-sm:flex-wrap">
          <div className="size-5 relative shrink-0 cursor-pointer">
            <img alt="" className="absolute inset-0 size-full" src={imgIconBell} />
          </div>
          <div className="flex gap-2 items-center max-sm:flex-wrap">
            <div className="bg-[#0f62fe] flex items-center justify-center rounded-full size-7 shrink-0 max-sm:flex-wrap">
              <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-white text-[11px] leading-normal" style={{ fontVariationSettings: '"wdth" 100' }}>RA</p>
            </div>
            <p className="font-['IBM Plex Sans:Medium'] font-medium text-[#161616] text-[13px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Raj Anand</p>
          </div>
        </div>
      </header>

      {/* Site Page Header */}
      <div className="bg-white border-b border-[#e0e0e0] flex flex-col gap-3 px-6 py-4">
        {/* Breadcrumbs */}
        <div className="flex gap-2 items-center max-sm:flex-wrap">
          <button onClick={onBack} className="font-['IBM Plex Sans:Regular'] font-normal text-[#525252] text-[13px] leading-normal hover:text-[#0f62fe] transition-colors" style={{ fontVariationSettings: '"wdth" 100' }}>Sites</button>
          <p className="text-[#8d8d8d] text-[13px]">/</p>
          <button onClick={onBack} className="font-['IBM Plex Sans:Regular'] font-normal text-[#525252] text-[13px] leading-normal hover:text-[#0f62fe] transition-colors" style={{ fontVariationSettings: '"wdth" 100' }}>Kuppam Solar Site</button>
          <p className="text-[#8d8d8d] text-[13px]">/</p>
          <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#525252] text-[13px] leading-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Live overview</p>
        </div>

        {/* Title + Actions row */}
        <div className="flex flex-col lg:flex-row gap-4 items-start justify-between">
          <div className="flex flex-col gap-2 flex-1 min-w-0">
            <div className="flex gap-3 items-center max-sm:flex-wrap">
              <div className="bg-[#fef8ed] flex items-center justify-center rounded-[2px] size-8 shrink-0 max-sm:flex-wrap">
                <div className="size-6 relative">
                  <img alt="" className="absolute inset-0 size-full" src={imgIconSun} />
                </div>
              </div>
              <p className="font-['IBM Plex Sans:Bold'] font-bold text-[#161616] text-[24px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Kuppam Solar Site · KUP-SOLAR-001</p>
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              <div className="bg-[#e5f6ed] px-2 py-1 rounded-[2px]">
                <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#198038] text-[12px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Operational</p>
              </div>
              <div className="bg-[#f3f4f6] px-2 py-1 rounded-[2px]">
                <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#525252] text-[12px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Solar PV</p>
              </div>
              <div className="bg-[#f3f4f6] px-2 py-1 rounded-[2px]">
                <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#525252] text-[12px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>45 MW · {flow.soc}% SOC</p>
              </div>
            </div>
            <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#525252] text-[14px] leading-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Andhra Pradesh, India · Commissioned 2021 · Snapshot {flow.timestamp}</p>
          </div>
          <div className="flex gap-3 items-center w-full lg:w-auto min-w-0 flex-wrap lg:justify-end">
            <div className="bg-[#f4f0ff] flex gap-1.5 items-center px-2 py-1 rounded-[2px] max-sm:flex-wrap">
              <div className="size-4 relative shrink-0">
                <img alt="" className="absolute inset-0 size-full" src={imgIconBot} />
              </div>
              <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#8a3ffc] text-[12px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>
                {state.activated ? (state.stage === 'Executing' ? 'BOB Executing' : 'BOB Active') : `BOB ${state.stage}`}
              </p>
            </div>
            <div className="bg-[#ecfdf3] px-2 py-1 rounded-[2px]">
              <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#198038] text-[12px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Data: Preview</p>
            </div>
            <div className="bg-[#f3f4f6] px-2 py-1 rounded-[2px]">
              <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#525252] text-[12px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Mode: Balanced</p>
            </div>
            <BobToggle />
            <button onClick={onBob} className="bg-[#0f62fe] px-4 py-2 rounded-[2px] cursor-pointer hover:bg-[#0353e9] transition-colors">
              <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-white text-[13px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Configure Actions</p>
            </button>
            <button className="bg-white border border-[#e0e0e0] p-2 rounded-[2px] cursor-pointer hover:bg-[#f4f4f4] transition-colors">
              <div className="size-4 relative">
                <img alt="" className="absolute inset-0 size-full" src={imgMoreHorizontal} />
              </div>
            </button>
          </div>
        </div>

        <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#525252] text-[13px] leading-normal" style={{ fontVariationSettings: '"wdth" 100' }}>
          Snapshot {flow.timestamp} · Preview source ages: site sensors 12s, weather 24s, battery 8s, grid 15s (not live telemetry)
        </p>
      </div>

      {/* Page Tabs */}
      <div className="bg-white border-b border-[#e0e0e0] flex gap-8 items-center h-12 px-6 sticky top-6 md:p-12 z-10 max-sm:flex-wrap">
        {[
          { label: 'Site Details', active: false },
          { label: 'Live overview', active: true },
          { label: 'AI Actions', active: false },
          { label: 'Maintenance', active: false },
          { label: 'Activity log', active: false },
        ].map(({ label, active }) => (
          <div
            key={label}
            className="flex flex-col gap-1 items-center cursor-pointer"
            onClick={() => { if (label === 'Site Details') onBack(); else onTabChange?.(label); }}
          >
            <p className={`font-['IBM Plex Sans:${active ? 'SemiBold' : 'Medium'}'] ${active ? 'font-semibold text-[#0f62fe]' : 'font-medium text-[#525252] hover:text-[#161616]'} text-[13px] leading-normal whitespace-nowrap max-sm:whitespace-normal transition-colors`} style={{ fontVariationSettings: '"wdth" 100' }}>{label}</p>
            <div className={`${active ? 'bg-[#0f62fe]' : 'bg-transparent'} h-0.5 w-[72px]`} />
          </div>
        ))}
      </div>

      {/* Weather Strip */}
      <div className="bg-[#f8fafc] border-b border-t border-[#e0e0e0] flex flex-col gap-2 px-4 py-2.5">
        {/* Row 1 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 items-center w-full">
          {[
            { icon: imgIconWrap, label: 'Condition', value: weather.condition, valueClass: 'text-[#161616]' },
            { icon: imgThermometer, label: 'Ambient', value: weather.ambientTemp, valueClass: 'text-[#161616]' },
            { icon: imgThermometer, label: 'Module Temp', value: weather.moduleTemp, valueClass: 'text-[#161616]', badge: true },
            { icon: imgIconWrap, label: 'Solar', value: weather.solarIrradiance, valueClass: 'text-[#161616]', arrow: true },
            { icon: imgWind, label: 'Wind Speed', value: weather.windSpeed, valueClass: 'text-[#161616]' },
          ].map((item, i) => (
            <div key={i} className="flex flex-1 flex-col gap-1 items-center min-w-0">
              <div className="size-5 relative shrink-0">
                <img alt="" className="absolute inset-0 size-full" src={item.icon} />
              </div>
              <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#8d8d8d] text-[11px] leading-normal text-center w-full" style={{ fontVariationSettings: '"wdth" 100' }}>{item.label}</p>
              <div className="flex gap-1 items-center max-sm:flex-wrap">
                <p className={`font-['IBM Plex Sans:SemiBold'] font-semibold ${item.valueClass} text-[13px] leading-normal text-center whitespace-nowrap max-sm:whitespace-normal`} style={{ fontVariationSettings: '"wdth" 100' }}>{item.value}</p>
                {item.badge && (
                  <div className="size-1.5 relative shrink-0">
                    <img alt="" className="absolute inset-0 size-full" src={imgEllipse6} />
                  </div>
                )}
                {item.arrow && (
                  <div className="size-3.5 relative shrink-0">
                    <img alt="" className="absolute inset-0 size-full" src={imgArrowUp} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        {/* Row 2 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 items-center w-full">
          {[
            { icon: imgDroplet, label: 'Humidity', value: weather.humidity, valueClass: 'text-[#161616]' },
            { icon: imgCloud, label: 'Clouds', value: weather.cloudCover, valueClass: 'text-[#161616]' },
            { icon: imgIconWrap, label: 'UV Index', value: weather.uvIndex, valueClass: 'text-[#161616]', uvTag: true },
            { icon: imgIconWrap, label: 'Next 3h', value: weather.forecastTrend, valueClass: 'text-[#198038]' },
            { icon: imgClock, label: 'Last updated', value: weather.lastUpdated, valueClass: 'text-[#161616]' },
          ].map((item, i) => (
            <div key={i} className="flex flex-1 flex-col gap-1 items-center min-w-0">
              <div className="size-5 relative shrink-0">
                <img alt="" className="absolute inset-0 size-full" src={item.icon} />
              </div>
              <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#8d8d8d] text-[11px] leading-normal text-center w-full" style={{ fontVariationSettings: '"wdth" 100' }}>{item.label}</p>
              <div className="flex gap-1 items-center max-sm:flex-wrap">
                <p className={`font-['IBM Plex Sans:SemiBold'] font-semibold ${item.valueClass} text-[13px] leading-normal text-center whitespace-nowrap max-sm:whitespace-normal`} style={{ fontVariationSettings: '"wdth" 100' }}>{item.value}</p>
                {item.uvTag && (
                  <div className="bg-[#fff7ed] px-1.5 py-0.5 rounded-[2px]">
                    <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#c2410c] text-[11px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>High</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Body */}
      <main className="flex flex-col gap-8 px-6 py-8 pb-12">

        {/* Metrics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-stretch w-full">
          {/* Solar Generation */}
          <div className="bg-white border border-[#e0e0e0] flex flex-1 flex-col gap-4 items-start min-w-0 p-5 rounded-[2px]">
            <div className="flex flex-wrap gap-3 items-center justify-between w-full">
              <div className="flex gap-2 items-center max-sm:flex-wrap">
                <div className="flex items-center justify-center overflow-clip size-[18px] shrink-0 max-sm:flex-wrap">
                  <img alt="" className="size-full" src={imgFrame} />
                </div>
                <p className="font-['IBM Plex Sans:Medium'] font-medium text-[#525252] text-[13px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Solar Generation</p>
              </div>
              <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#198038] text-[12px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>84% of capacity</p>
            </div>
            <p className="font-['IBM Plex Sans:Bold'] font-bold text-[#161616] text-[28px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>38 MW</p>
            <div className="flex flex-col gap-1 w-full">
              <div className="bg-[#f4f4f6] flex h-1.5 items-start overflow-hidden rounded-[2px] w-full max-sm:flex-wrap">
                <div className="bg-[#f8b84e] h-1.5 w-[84%]" />
              </div>
              <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#525252] text-[12px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Forecast 45 MW · 7 MW below forecast</p>
            </div>
          </div>

          {/* Local Demand */}
          <div className="bg-white border border-[#e0e0e0] flex flex-1 flex-col gap-4 items-start min-w-0 p-5 rounded-[2px]">
            <div className="flex flex-wrap gap-3 items-center justify-between w-full">
              <div className="flex gap-2 items-center max-sm:flex-wrap">
                <div className="flex items-center justify-center overflow-clip size-[18px] shrink-0 max-sm:flex-wrap">
                  <img alt="" className="size-full" src={imgFrame1} />
                </div>
                <p className="font-['IBM Plex Sans:Medium'] font-medium text-[#525252] text-[13px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Local Demand</p>
              </div>
              <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#198038] text-[12px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>{Math.round((38 + flow.battery + flow.grid) / flow.demand * 100)}% covered</p>
            </div>
            <p className="font-['IBM Plex Sans:Bold'] font-bold text-[#161616] text-[28px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>{flow.demand} MW</p>
            <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#525252] text-[12px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>{flow.deficit > 0 ? `${flow.deficit} MW deficit — additional supply or load shedding required` : "Critical demand fully covered"}</p>
          </div>

          {/* Battery */}
          <div className="bg-white border border-[#e0e0e0] flex flex-1 flex-col gap-4 items-start min-w-0 p-5 rounded-[2px]">
            <div className="flex flex-wrap gap-3 items-center justify-between w-full">
              <div className="flex gap-2 items-center max-sm:flex-wrap">
                <div className="flex items-center justify-center overflow-clip size-[18px] shrink-0 max-sm:flex-wrap">
                  <img alt="" className="size-full" src={imgFrame2} />
                </div>
                <p className="font-['IBM Plex Sans:Medium'] font-medium text-[#525252] text-[13px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Battery</p>
              </div>
              <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#f8b84e] text-[12px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Discharging at {flow.battery} MW</p>
            </div>
            <p className="font-['IBM Plex Sans:Bold'] font-bold text-[#161616] text-[28px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>{flow.soc}%</p>
            <div className="flex flex-col gap-1 w-full">
              <div className="bg-[#f4f4f6] flex h-1.5 items-start overflow-hidden rounded-[2px] w-full max-sm:flex-wrap">
                <div className="bg-[#f8b84e] h-1.5" style={{ width: `${flow.soc}%` }} />
              </div>
              <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#525252] text-[12px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Reserve {(state.activeConfig?.limits.reserveSOC ?? 55)}% · Action duration cap {flow.durationMinutes} min</p>
            </div>
          </div>

          {/* Grid */}
          <div className="bg-white border border-[#e0e0e0] flex flex-1 flex-col gap-4 items-start min-w-0 p-5 rounded-[2px]">
            <div className="flex flex-wrap gap-3 items-center justify-between w-full">
              <div className="flex gap-2 items-center max-sm:flex-wrap">
                <div className="flex items-center justify-center overflow-clip size-[18px] shrink-0 max-sm:flex-wrap">
                  <img alt="" className="size-full" src={imgFrame3} />
                </div>
                <p className="font-['IBM Plex Sans:Medium'] font-medium text-[#525252] text-[13px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Grid</p>
              </div>
              <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#0f62fe] text-[12px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>{flow.grid > 0 ? "Importing (preview)" : "No import"}</p>
            </div>
            <p className="font-['IBM Plex Sans:Bold'] font-bold text-[#161616] text-[28px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>{flow.grid} MW import</p>
            <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#525252] text-[12px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>{state.approval ? `Grid action: ${state.approval.decision} · Actual import ${flow.grid} MW` : "Connected · No import"}</p>
          </div>
        </div>

        {/* Balance Statement */}
        <div className="bg-white border border-[#e0e0e0] flex flex-col gap-2 items-start p-4 rounded-[2px] w-full">
          <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#161616] text-[14px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Balance statement</p>
          <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#525252] text-[13px] leading-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Solar {flow.solar} MW + Battery discharge {flow.battery} MW + Grid {flow.grid} MW = {flow.solar + flow.battery + flow.grid} MW supply / {flow.demand} MW demand. Surplus/export is 0 MW. Battery SOC is {flow.soc}%. {flow.deficit > 0 ? `${flow.deficit} MW remains uncovered.` : "Supply is balanced."}</p>
        </div>

        {/* Inline Warning Notification */}
        <div className="bg-[#fef8ed] border border-[#f8b84e] flex gap-3 items-center p-4 rounded-[2px] w-full max-sm:flex-wrap">
          <div className="bg-[#f8b84e] flex items-center justify-center rounded-full size-5 shrink-0 max-sm:flex-wrap">
            <p className="font-['IBM Plex Sans:Bold'] font-bold text-white text-[12px] leading-none" style={{ fontVariationSettings: '"wdth" 100' }}>!</p>
          </div>
          <div className="flex flex-1 flex-col gap-0.5 min-w-0">
            <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#161616] text-[14px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Generation is below forecast</p>
            <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#525252] text-[13px] leading-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Solar output is 7 MW below the 45 MW forecast due to increased cloud cover. Battery discharge is {flow.battery} MW. Grid import is {flow.grid} MW. {flow.deficit > 0 ? `${flow.deficit} MW deficit remains; approval or further action required.` : "Local demand remains fully covered."}</p>
          </div>
        </div>

        {/* Live Generation & Demand Chart Card */}
        <div className="bg-white border border-[#e0e0e0] flex flex-col gap-5 items-start p-6 rounded-[2px] w-full">
          <div className="flex flex-wrap gap-3 items-center justify-between w-full">
            <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#161616] text-[16px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Live generation and demand</p>
            <div className="flex gap-3 items-center max-sm:flex-wrap">
              <div className="bg-[#fef8ed] border border-[#f8b84e] px-2 py-1 rounded-full">
                <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#b26207] text-[12px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>2 Alerts</p>
              </div>
              <div className="bg-[#f6ffed] border border-[#bbf7d0] px-2 py-1 rounded-full">
                <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#15803d] text-[12px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>5 Sources Live</p>
              </div>
              <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#8d8d8d] text-[13px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Snapshot {flow.timestamp}</p>
            </div>
          </div>

          {/* Chart Area */}
          <div className="h-[220px] overflow-x-auto relative w-full">
            <div className="absolute bg-[#f4f4f6] h-px left-0 right-0 top-[40px]" />
            <div className="absolute bg-[#f4f4f6] h-px left-0 right-0 top-[100px]" />
            <div className="absolute bg-[#f4f4f6] h-px left-0 right-0 top-[160px]" />
            <p className="absolute font-['IBM Plex Sans:Regular'] font-normal text-[#8d8d8d] text-[11px] leading-normal left-2.5 top-8 whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>50 MW</p>
            <p className="absolute font-['IBM Plex Sans:Regular'] font-normal text-[#8d8d8d] text-[11px] leading-normal left-2.5 top-[92px] whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>25 MW</p>
            <p className="absolute font-['IBM Plex Sans:Regular'] font-normal text-[#8d8d8d] text-[11px] leading-normal left-2.5 top-[152px] whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>0 MW</p>
            <div className="absolute h-0 left-20 top-[60px] w-[600px]">
              <div className="absolute inset-[-2px_0_0_0]">
                <img alt="" className="block max-w-none size-full" height="2" src={imgLine} width="600" />
              </div>
            </div>
            <div className="absolute bg-[#fdf1f2] h-10 left-60 opacity-60 rounded-[2px] top-[60px] w-[180px]" />
            <p className="absolute font-['IBM Plex Sans:SemiBold'] font-semibold text-[#da1e28] text-[11px] leading-normal left-[280px] top-[70px] whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>8 MW SHORTFALL</p>
            <div className="absolute bg-[#fef8ed] h-20 left-20 rounded-tl-[2px] rounded-tr-[2px] top-[100px] w-[600px]" />
            <div className="absolute h-0 left-20 top-[100px] w-[600px]">
              <div className="absolute inset-[-3px_0_0_0]">
                <img alt="" className="block max-w-none size-full" src={imgLine1} />
              </div>
            </div>
            <div className="absolute flex h-[160px] items-center justify-center left-80 top-5 w-0 max-sm:flex-wrap">
              <div className="flex-none rotate-90 max-sm:flex-wrap">
                <div className="h-0 relative w-[160px]">
                  <div className="absolute inset-[-1.5px_0_0_0]">
                    <img alt="" className="block max-w-none size-full" height="1.5" src={imgLine2} width="160" />
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute bg-[#0f62fe] flex items-start left-[290px] px-1.5 py-0.5 rounded-[2px] top-2.5 max-sm:flex-wrap">
              <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-white text-[9px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>NOW</p>
            </div>
          </div>

          {/* Legend row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-start w-full max-sm:flex-wrap">
            {[
              { dot: imgEllipse, label: 'Current', value: '38 MW' },
              { dot: imgEllipse1, label: 'Forecast', value: '45 MW' },
              { dot: imgEllipse2, label: 'Shortfall', value: '8 MW' },
              { dot: imgEllipse3, label: 'Peak today', value: '43 MW' },
            ].map((item) => (
              <div key={item.label} className="bg-white border border-[#e0e0e0] flex flex-1 gap-2 items-center min-w-0 px-3 py-2.5 rounded-[2px] max-sm:flex-wrap">
                <div className="size-2 relative shrink-0">
                  <img alt="" className="absolute inset-0 size-full" src={item.dot} />
                </div>
                <p className="flex-1 font-['IBM Plex Sans:Regular'] font-normal text-[#525252] text-[12px] leading-normal min-w-0 max-sm:flex-wrap" style={{ fontVariationSettings: '"wdth" 100' }}>{item.label}</p>
                <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#161616] text-[13px] leading-normal whitespace-nowrap max-sm:whitespace-normal shrink-0" style={{ fontVariationSettings: '"wdth" 100' }}>{item.value}</p>
              </div>
            ))}
          </div>

          <div className="bg-[#e0e0e0] h-px w-full" />

          {/* Conditions / Alerts / Data Sources */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start w-full">
            {/* Conditions */}
            <div className="flex flex-1 flex-col gap-3 items-start min-w-0">
              <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#161616] text-[13px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Conditions affecting generation</p>
              <div className="flex flex-col gap-2 w-full">
                {generationConditions.map((item) => (
                  <div key={item.label} className="border-b border-[#e0e0e0] flex flex-wrap gap-3 items-center justify-between pb-2 w-full">
                    <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#525252] text-[13px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>{item.label}</p>
                    <p className={`font-['IBM Plex Sans:SemiBold'] font-semibold ${item.valueClass} text-[13px] leading-normal whitespace-nowrap max-sm:whitespace-normal`} style={{ fontVariationSettings: '"wdth" 100' }}>{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="bg-[#fef8ed] border-l-4 border-[#f8b84e] flex flex-col items-start p-3 rounded-[2px] w-full">
                <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#b26207] text-[12px] leading-normal w-full" style={{ fontVariationSettings: '"wdth" 100' }}>Cloud cover increased from 18% to 42%, reducing output. Expected to improve by 3:00 PM.</p>
              </div>
            </div>

            {/* Active Alerts */}
            <div className="flex flex-1 flex-col gap-3 items-start min-w-0">
              <div className="flex gap-2 items-center max-sm:flex-wrap">
                <div className="size-2 relative shrink-0">
                  <img alt="" className="absolute inset-0 size-full" src={imgEllipse} />
                </div>
                <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#161616] text-[13px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Active alerts</p>
              </div>
              <div className="flex flex-col gap-2 w-full">
                {activeAlerts.map((alert) => (
                  <div key={alert} className="border-b border-[#e0e0e0] flex gap-2.5 items-start pb-2 w-full max-sm:flex-wrap">
                    <div className="bg-[#f8b84e] h-6 rounded-[2px] shrink-0 w-0.5" />
                    <p className="flex-1 font-['IBM Plex Sans:Regular'] font-normal text-[#525252] text-[12px] leading-normal min-w-0 max-sm:flex-wrap" style={{ fontVariationSettings: '"wdth" 100' }}>{alert}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Data Sources */}
            <div className="flex flex-1 flex-col gap-2.5 items-start min-w-0">
              <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#161616] text-[13px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Data sources</p>
              <div className="flex flex-col gap-2 w-full">
                {monitoringFeeds.map((src) => (
                  <div key={src.name} className="flex gap-2 items-center w-full max-sm:flex-wrap">
                    <div className="size-2 relative shrink-0">
                      <img alt="" className="absolute inset-0 size-full" src={imgEllipse4} />
                    </div>
                    <p className="flex-1 font-['IBM Plex Sans:Regular'] font-normal text-[#525252] text-[12px] leading-normal min-w-0 max-sm:flex-wrap" style={{ fontVariationSettings: '"wdth" 100' }}>{src.name} • Preview {src.ageSeconds} seconds</p>
                  </div>
                ))}
              </div>
              <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#525252] text-[12px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>{monitoringFeeds.length} of {monitoringFeeds.length} monitoring feeds available</p>
              <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#0f62fe] text-[12px] leading-normal underline decoration-solid whitespace-nowrap max-sm:whitespace-normal cursor-pointer" style={{ fontVariationSettings: '"wdth" 100' }}>View connections</p>

            </div>
          </div>
        </div>

        {/* Energy Flow Card */}
        <div className="bg-white border border-[#e0e0e0] flex flex-col gap-6 items-start p-6 rounded-[2px] w-full">
          <div className="flex flex-wrap gap-3 items-center justify-between w-full">
            <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#161616] text-[16px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Energy flow</p>
            <div className="bg-[#ecfdf3] flex items-center px-2.5 py-1.5 rounded-full max-sm:flex-wrap">
              <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#198038] text-[12px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Preview</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start w-full">
            {/* Generation */}
            <div className="flex flex-1 flex-col gap-3 items-start min-w-0">
              <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#525252] text-[13px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Generation</p>
              {[
                { color: '#f8b84e', label: 'Solar', value: '38 MW', pct: 38 / (38 + flow.battery + flow.grid) * 100 },
                { color: '#198038', label: 'Battery', value: `${flow.battery} MW`, pct: flow.battery / (38 + flow.battery + flow.grid) * 100 },
                { color: '#0f62fe', label: 'Grid Import', value: `${flow.grid} MW`, pct: flow.grid / (38 + flow.battery + flow.grid) * 100 },
              ].map((item) => (
                <div key={item.label} className="flex flex-col gap-1.5 w-full">
                  <div className="flex flex-wrap gap-3 items-center justify-between w-full">
                    <div className="flex gap-2 items-center max-sm:flex-wrap">
                      <div className="rounded-[4px] shrink-0 size-2" style={{ backgroundColor: item.color }} />
                      <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#525252] text-[13px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>{item.label}</p>
                    </div>
                    <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#161616] text-[13px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>{item.value}</p>
                  </div>
                  <div className="bg-[#f3f4f6] flex h-1.5 items-start overflow-hidden rounded-full w-full max-sm:flex-wrap">
                    <div className="h-1.5 rounded-full" style={{ width: `${item.pct}%`, backgroundColor: item.color }} />
                  </div>
                </div>
              ))}
              <div className="flex flex-wrap gap-3 items-center justify-between w-full">
                <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#525252] text-[13px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Total</p>
                <p className="font-['IBM Plex Sans:Bold'] font-bold text-[#161616] text-[13px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>{38 + flow.battery + flow.grid} MW</p>
              </div>
            </div>

            {/* Consumption */}
            <div className="flex flex-1 flex-col gap-3 items-start min-w-0">
              <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#525252] text-[13px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Consumption</p>
              {[
                { color: '#6b7280', label: 'Local Demand', value: `${flow.demand} MW`, pct: 100 },
                { color: '#198038', label: 'Surplus / Export', value: '0 MW', pct: 0 },
              ].map((item) => (
                <div key={item.label} className="flex flex-col gap-1.5 w-full">
                  <div className="flex flex-wrap gap-3 items-center justify-between w-full">
                    <div className="flex gap-2 items-center max-sm:flex-wrap">
                      <div className="rounded-[4px] shrink-0 size-2" style={{ backgroundColor: item.color }} />
                      <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#525252] text-[13px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>{item.label}</p>
                    </div>
                    <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#161616] text-[13px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>{item.value}</p>
                  </div>
                  <div className="bg-[#f3f4f6] flex h-1.5 items-start overflow-hidden rounded-full w-full max-sm:flex-wrap">
                    <div className="h-1.5 rounded-full" style={{ width: `${item.pct}%`, backgroundColor: item.color }} />
                  </div>
                </div>
              ))}
              <div className="flex flex-wrap gap-3 items-center justify-between w-full">
                <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#525252] text-[13px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Total</p>
                <p className="font-['IBM Plex Sans:Bold'] font-bold text-[#161616] text-[13px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>{flow.demand} MW</p>
              </div>
            </div>
          </div>

          {/* Renewable Share footer */}
          <div className="bg-[#f9fafb] border-t border-[#e0e0e0] flex flex-wrap gap-3 items-center justify-between px-6 py-4 -mx-6 -mb-6 w-[calc(100%+48px)]">
            <div className="flex gap-2 items-center max-sm:flex-wrap">
              <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#525252] text-[13px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Renewable share</p>
              <div className="flex gap-2 items-center max-sm:flex-wrap">
                <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#198038] text-[13px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>{Math.round((38 + flow.battery) / flow.demand * 100)}%</p>
                <div className="size-6 relative shrink-0">
                  <img alt="" className="absolute inset-0 size-full" src={imgFrame4} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Battery Storage Card */}
        <div className="bg-white border border-[#e0e0e0] flex flex-col gap-5 items-start p-6 rounded-[2px] w-full">
          <div className="flex flex-wrap gap-3 items-center justify-between w-full">
            <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#161616] text-[16px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Battery storage</p>
            <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#8d8d8d] text-[13px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>{flow.soc}% charged</p>
          </div>

          {/* Available Capacity Bar */}
          <div className="flex flex-col gap-3 w-full">
            <div className="flex flex-wrap gap-3 items-center justify-between w-full">
              <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#525252] text-[13px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Available Capacity</p>
              <p className="font-['IBM Plex Sans:Bold'] font-bold text-[#8a3ffc] text-[14px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>{flow.soc}%</p>
            </div>
            <div className="bg-[#f4f4f6] flex h-6 items-start overflow-hidden relative rounded-[2px] w-full max-sm:flex-wrap">
              <div className="bg-[#198038] h-6" style={{ width: `${flow.soc}%` }} />
              <div className="absolute bg-[#f59e0b] h-6 top-0" style={{ left: `${(state.activeConfig ?? state.config).limits.reserveSOC}%`, width: '2px' }} />
            </div>
          </div>

          {/* Stats */}
          <div className="flex flex-col gap-2.5 w-full">
            {[
              { label: 'Total Capacity', value: '20 MWh', valueClass: 'text-[#161616]' },
              { label: 'Available energy', value: `${(flow.soc * 0.2).toFixed(1)} MWh`, valueClass: 'text-[#161616]' },
              { label: 'Reserve limit', value: `${(state.activeConfig ?? state.config).limits.reserveSOC}% (${((state.activeConfig ?? state.config).limits.reserveSOC * 0.2).toFixed(1)} MWh)`, valueClass: 'text-[#da1e28]' },
              { label: 'Usable', value: `${Math.max(0, (flow.soc - (state.activeConfig ?? state.config).limits.reserveSOC) * 0.2).toFixed(1)} MWh`, valueClass: 'text-[#161616]' },
              { label: 'Current action', value: `Discharging at ${flow.battery} MW`, valueClass: 'text-[#f8b84e]' },
              { label: 'Duration remaining', value: `${Math.max(0, flow.durationMinutes - flow.elapsedMinutes)} min remaining (max ${flow.durationMinutes} min / ${(state.activeConfig ?? state.config).limits.maxEnergyMWh} MWh)`, valueClass: 'text-[#161616]' },
            ].map((item) => (
              <div key={item.label} className="flex flex-wrap gap-3 items-center justify-between w-full">
                <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#525252] text-[13px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>{item.label}</p>
                <p className={`font-['IBM Plex Sans:SemiBold'] font-semibold ${item.valueClass} text-[13px] leading-normal whitespace-nowrap max-sm:whitespace-normal`} style={{ fontVariationSettings: '"wdth" 100' }}>{item.value}</p>
              </div>
            ))}
          </div>

          {/* BOB Note */}
          <div className="bg-[#f4f0ff] border-l-4 border-[#8a3ffc] flex flex-col items-start p-3 rounded-[2px] w-full">
            <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#8a3ffc] text-[13px] leading-normal w-full" style={{ fontVariationSettings: '"wdth" 100' }}>
              {state.activated
                ? `BOB active configuration monitoring Battery 1. Discharging at ${flow.battery} MW. Discharge stops at 55% reserve or after reaching the action cap.`
                : `Baseline dispatch of 6 MW active in preview. BOB configuration status is ${state.stage}; activation required to govern autonomous dispatch.`}
            </p>
          </div>
        </div>

      </main>
    </div>
  );
}
