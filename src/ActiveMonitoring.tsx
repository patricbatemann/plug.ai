import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useOperations } from './Operations';
import { useBobChat, BobMessages, BobComposer, BobChatScrollArea } from './BobChat';
import { BATTERY_POLICY, SITE, SNAPSHOT_14_32, SNAPSHOT_14_50, STATE_COLOR } from './data';
import type { ActionConfig } from './AgentChat';

const assetPathPrefix = '/assets';
const imgBrainCog = `${assetPathPrefix}/71557.svg`;
const imgEllipse = `${assetPathPrefix}/2ea7c.svg`;
const imgCheck1 = `${assetPathPrefix}/f6f5a.svg`;
const imgArrowRight = `${assetPathPrefix}/21c0f.svg`;
const imgBot = `${assetPathPrefix}/0d037.svg`;
const imgChevronDown = `${assetPathPrefix}/291fd.svg`;
const imgXCircle = `${assetPathPrefix}/179e0.svg`;

interface ActiveMonitoringProps {
  config: ActionConfig;
  onBack: () => void;
  onApprovalReview: () => void;
}

type ScenarioPhase = '14:32' | '14:50_proposed' | '14:50_approved' | '14:50_modified' | '14:50_rejected';

function ibm(w: 'Regular' | 'Medium' | 'SemiBold' | 'Bold', extra = '') {
  const wMap = { Regular: 'normal', Medium: 'medium', SemiBold: 'semibold', Bold: 'bold' };
  return { className: `font-['IBM Plex Sans:${w}'] font-${wMap[w]} ${extra}`, style: { fontVariationSettings: '"wdth" 100' } };
}

function FlowBar({ solar, battery, grid, demand, showDeficit }: { solar: number; battery: number; grid: number; demand: number; showDeficit?: boolean }) {
  const supplied = solar + battery + grid;
  const deficit = demand - supplied;
  return (
    <div className="bg-[#f9fafb] border border-[#e5e7eb] p-5 rounded-[2px]">
      <div className="flex items-end gap-2 mb-4">
        {[
          { label: 'Solar', value: solar, color: '#f59e0b' },
          { label: 'Battery discharge', value: battery, color: '#0f62fe' },
          { label: 'Grid import', value: grid, color: '#94a3b8', proposed: showDeficit && grid === 0 },
        ].map(src => (
          <div key={src.label} className="flex flex-col items-center gap-1.5 flex-1">
            <p {...ibm('Bold', 'text-[16px]')} style={{ color: src.color }}>{src.value} MW</p>
            <div className="w-full rounded-t-[2px]" style={{ height: `${(src.value / demand) * 80}px`, backgroundColor: src.color, opacity: src.value === 0 ? 0.2 : 1 }} />
            <p {...ibm('Regular', 'text-[#525252] text-[11px] text-center')}>{src.label}</p>
          </div>
        ))}
        <div className="flex items-center self-center text-[#94a3b8] text-[20px]">{deficit > 0 ? "≠" : "="}</div>
        <div className="flex flex-col items-center gap-1.5 flex-1">
          <p {...ibm('Bold', 'text-[18px] text-[#6366f1]')}>{demand} MW</p>
          <div className="w-full bg-[#6366f1] rounded-t-[2px]" style={{ height: `${(demand / demand) * 80}px` }} />
          <p {...ibm('Regular', 'text-[#525252] text-[11px] text-center')}>Demand</p>
        </div>
      </div>
      {showDeficit && deficit > 0 && (
        <div className="bg-[#fef2f2] border border-[#dc2626]/20 p-3 rounded-[2px]">
          <p {...ibm('SemiBold', 'text-[#dc2626] text-[13px]')}>⚠ {deficit} MW uncovered — grid import pending approval or load shedding required</p>
        </div>
      )}
      {!showDeficit && supplied === demand && (
        <div className="bg-[#e6f4ea] p-3 rounded-[2px]">
          <p {...ibm('Medium', 'text-[#1a7f37] text-[13px]')}>✓ Energy balance: {solar} + {battery}{grid > 0 ? ` + ${grid}` : ''} = {demand} MW</p>
        </div>
      )}
    </div>
  );
}

export default function ActiveMonitoring({ config, onBack, onApprovalReview }: ActiveMonitoringProps) {
  const operations = useOperations();
  const { state, flow } = operations;
  useEffect(() => { if (state.activated && state.stage === 'Active') operations.setState(current => ({ ...current, stage: 'Executing' })); }, [state.activated, state.stage]);
  const scenario: ScenarioPhase = !state.spike ? '14:32' : state.approval?.decision === 'approved' ? state.approval.mw === 8 ? '14:50_approved' : '14:50_modified' : state.approval?.decision === 'pending' ? '14:50_proposed' : '14:50_rejected';
  const [askBobOpen, setAskBobOpen] = useState(false);
  const batteryState = flow.completed ? 'Completed' : state.batteryPaused ? 'Active' : 'Executing';
  const is1432 = scenario === '14:32';
  const is1450 = scenario.startsWith('14:50');
  const isApproved = scenario === '14:50_approved';
  const isModified = scenario === '14:50_modified';
  const isRejected = scenario === '14:50_rejected';
  const isProposed = scenario === '14:50_proposed';

  const solar = 38, battery = flow.battery;
  const demand1432 = 44, demand1450 = 52;
  const gridApproved = 8, gridModified = 6, gridRejected = 0;

  const currentDemand = is1432 ? demand1432 : demand1450;
  const currentGrid = flow.grid;
  const showDeficit = flow.deficit > 0;

  const chat = useBobChat('monitoring', { config, scenario, solarMW: solar, batteryMW: battery, demandMW: currentDemand, gridImportMW: currentGrid, policy: BATTERY_POLICY });

  return (
    <div className="bg-[#f4f4f4] flex flex-col min-h-screen w-full">

      {/* Header */}
      <div className="bg-white border-b border-[#e5e7eb] flex min-h-14 flex-wrap gap-3 items-center justify-between py-3 px-6 shrink-0">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="bg-[#0f62fe] flex items-center justify-center rounded-[2px] size-8">
            <img alt="" className="size-5" src={imgBrainCog} />
          </div>
          <p {...ibm('SemiBold', 'text-[#1f2937] text-[16px]')}>{SITE.name}</p>
          <div className="bg-[#e6f4ea] px-2 py-1 rounded-[2px]">
            <p {...ibm('SemiBold', 'text-[#1a7f37] text-[11px]')}>Active</p>
          </div>
          <div className="flex gap-1.5 items-center">
            <img alt="" className="size-1.5" src={imgEllipse} />
            <p {...ibm('Regular', 'text-[#525252] text-[13px]')}>Operational preview · {flow.timestamp}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <button onClick={() => setAskBobOpen(!askBobOpen)} className="bg-[#0f62fe] flex items-center gap-2 px-3 py-1.5 rounded-[2px] hover:bg-[#0353e9] transition-colors cursor-pointer">
            <img alt="" className="size-4" src={imgBot} />
            <p {...ibm('SemiBold', 'text-white text-[13px]')}>Ask BOB</p>
          </button>
          <button onClick={onBack} className="border border-[#e5e7eb] px-3 py-1.5 rounded-[2px] hover:bg-[#f4f4f4] cursor-pointer">
            <p {...ibm('Medium', 'text-[#1f2937] text-[13px]')}>Back to site</p>
          </button>
        </div>
      </div>

      {/* Scenario switcher */}
      <div className="bg-white border-b border-[#e5e7eb] flex flex-wrap items-center gap-4 px-4 py-3 shrink-0">
        <p {...ibm('SemiBold', 'text-[#525252] text-[12px] uppercase tracking-wide')}>Scenario</p>
        <div className="flex flex-wrap gap-2">
          {[
            { id: '14:32', label: '14:32 — Stable operation' },
            { id: '14:50_proposed', label: '14:50 — Demand spike (8 MW deficit)' },
          ].map(s => (
            <button key={s.id} disabled={s.id === "14:32" && state.spike} onClick={() => { if (s.id !== "14:32") operations.requestImport(); }}
              className={`px-3 py-1.5 rounded-[2px] border text-[13px] cursor-pointer transition-colors ${scenario === s.id || (s.id === '14:50_proposed' && is1450) ? 'border-[#0f62fe] bg-[#e8f1ff]' : 'border-[#e5e7eb] hover:border-[#0f62fe]'}`}>
              <p {...ibm(scenario === s.id || (s.id === '14:50_proposed' && is1450) ? 'SemiBold' : 'Regular', scenario === s.id || (s.id === '14:50_proposed' && is1450) ? 'text-[#0f62fe]' : 'text-[#525252]')}>{s.label}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 flex-col lg:flex-row min-w-0">

        {/* Main */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex flex-col gap-6 max-w-3xl">

            {/* Action status card */}
            <div className="bg-white border border-[#e5e7eb] p-5 rounded-[2px]">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p {...ibm('Bold', 'text-[#1f2937] text-[18px]')}>Support demand using Battery 1</p>
                  <p {...ibm('Regular', 'text-[#525252] text-[13px] mt-0.5')}>Discharge battery to support site demand · {batteryState}</p>
                </div>
                <div className="px-2 py-1 rounded-[2px]" style={{ backgroundColor: is1432 || isApproved || isModified ? '#e8f1ff' : isProposed ? '#fff8e1' : '#fef2f2' }}>
                  <p {...ibm('SemiBold', 'text-[11px]')} style={{ color: is1432 || isApproved || isModified ? '#0f62fe' : isProposed ? '#e6a817' : '#dc2626', fontVariationSettings: '"wdth" 100' }}>
                    {batteryState}
                  </p>
                </div>
              </div>
              <FlowBar solar={solar} battery={battery} grid={currentGrid} demand={currentDemand} showDeficit={showDeficit || isRejected} />
            </div>

            {/* 14:50 scenario: BOB recommendation */}
            {is1450 && (
              <div className={`border p-5 rounded-[2px] ${isProposed ? 'bg-[#fff8e1] border-[#fcd34d]/60' : isApproved ? 'bg-[#e6f4ea] border-[#10b981]/40' : isModified ? 'bg-[#e8f1ff] border-[#0f62fe]/30' : 'bg-[#fef2f2] border-[#dc2626]/30'}`}>
                <div className="flex gap-3 items-start mb-4">
                  <div className="bg-[#0f62fe] flex items-center justify-center rounded-[2px] size-8 shrink-0">
                    <img alt="" className="size-4" src={imgBot} />
                  </div>
                  <div>
                    <p {...ibm('SemiBold', 'text-[#1f2937] text-[14px]')}>BOB recommendation · 01 Oct 2026, 14:50 IST</p>
                    {isProposed && <p {...ibm('Regular', 'text-[#525252] text-[13px] mt-1 leading-relaxed')}>
                      Demand has risen to {flow.demand} MW. Battery output is {flow.battery} MW. The remaining deficit is {flow.deficit} MW. I recommend reviewing an 8 MW grid import for 15 minutes. Administrator approval and verified safe control are required. {flow.deficit > 8 ? `${flow.deficit - 8} MW would still remain uncovered even if this import executes.` : ""}
                    </p>}
                    {isApproved && <p {...ibm('Regular', 'text-[#1a7f37] text-[13px] mt-1 leading-relaxed')}>
                      {state.approval?.executable ? "Approved: simulated grid import 8 MW for 15 minutes. Actual power and any remaining deficit are shown in the energy-flow panel. Preview only; no real equipment commands sent." : "Approved: 8 MW authorized for 15 minutes. Execution held until grid control is verified and granted. Grid import remains 0 MW; deficit remains uncovered. No equipment command sent."}
                    </p>}
                    {isModified && <p {...ibm('Regular', 'text-[#1e3a8a] text-[13px] mt-1 leading-relaxed')}>
                      Approved at 6 MW. {state.approval?.executable ? "Simulated grid import: 6 MW. At 6 MW battery output, 38 + 6 + 6 = 50 MW and 2 MW remains uncovered. Any change in battery output increases that deficit; see current flow." : "Execution held. Grid import remains 0 MW. If safely executed, 38 + 6 + 6 = 50 MW; 2 MW would remain uncovered."}
                    </p>}
                    {isRejected && <p {...ibm('Regular', 'text-[#dc2626] text-[13px] mt-1 leading-relaxed')}>
                      Grid request {state.approval?.decision}. Battery remains at the automatic limit. The 8 MW deficit is uncovered. Recovery behavior and the operations notification are recorded in the audit log.
                    </p>}
                  </div>
                </div>

                {isProposed && (
                  <div className="flex gap-3">
                    <button onClick={onApprovalReview} className="bg-[#0f62fe] flex items-center gap-2 px-4 py-2.5 rounded-[2px] hover:bg-[#0353e9] transition-colors cursor-pointer">
                      <p {...ibm('SemiBold', 'text-white text-[13px]')}>Review approval</p>
                      <img alt="" className="size-4" src={imgArrowRight} />
                    </button>
                    <button onClick={onApprovalReview} className="border border-[#10b981] px-4 py-2.5 rounded-[2px] hover:bg-[#f0fdf4] transition-colors cursor-pointer">
                      <p {...ibm('SemiBold', 'text-[#10b981] text-[13px]')}>Approve 8 MW</p>
                    </button>
                    <button onClick={onApprovalReview} className="border border-[#e5e7eb] px-4 py-2.5 rounded-[2px] hover:bg-[#f4f4f4] transition-colors cursor-pointer">
                      <p {...ibm('Medium', 'text-[#1f2937] text-[13px]')}>Approve 6 MW instead</p>
                    </button>
                    <button onClick={onApprovalReview} className="border border-[#dc2626]/40 px-4 py-2.5 rounded-[2px] hover:bg-[#fef2f2] transition-colors cursor-pointer">
                      <p {...ibm('Medium', 'text-[#dc2626] text-[13px]')}>Reject</p>
                    </button>
                  </div>
                )}

                {(isApproved || isModified) && (
                  <div className="flex gap-2 items-center">
                    <div className="bg-[#10b981] flex items-center justify-center rounded-full size-5">
                      <img alt="" className="size-3" src={imgCheck1} />
                    </div>
                    <p {...ibm('SemiBold', 'text-[#1a7f37] text-[13px]')}>
                      {state.approval?.executable ? `Approved ${state.approval.mw} MW — ${flow.deficit} MW deficit remains` : `Approved ${state.approval?.mw} MW — execution held; ${flow.deficit} MW deficit remains`}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Battery status */}
            {is1450 && <div className="border-l-4 border-[#ff832b] bg-[#fff4e5] p-4 text-xs text-[#8a3800]">The canonical battery action stops at 15:02 IST. If demand stays at 52 MW, an 8 MW grid import still leaves 6 MW uncovered after battery discharge stops; a 6 MW import leaves 8 MW uncovered. Additional approval, supply, or load shedding is required. No duration or energy cap is extended.</div>}
            <div className="bg-white border border-[#e5e7eb] p-5 rounded-[2px]">
              <p {...ibm('SemiBold', 'text-[#1f2937] text-[14px] mb-4')}>Battery 1 status</p>
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-3 items-center justify-between">
                  <p {...ibm('Regular', 'text-[#525252] text-[13px]')}>State of charge</p>
                  <p {...ibm('Bold', 'text-[#1f2937] text-[16px]')}>{flow.soc}%</p>
                </div>
                <div className="bg-[#f4f4f4] rounded-full h-3 overflow-hidden relative">
                  {/* Emergency floor marker */}
                  <div className="absolute top-0 h-full w-px bg-[#dc2626] z-10" style={{ left: `${BATTERY_POLICY.emergencyFloorSOC}%` }} />
                  {/* Reserve marker */}
                  <div className="absolute top-0 h-full w-px bg-[#f59e0b]" style={{ left: `${config.limits.reserveSOC}%` }} />
                  {/* Charge bar */}
                  <div className="h-full rounded-full transition-all" style={{ width: `${flow.soc}%`, background: 'linear-gradient(90deg, #10b981 60%, #0f62fe)' }} />
                </div>
                <div className="flex justify-between text-[11px]">
                  <span {...ibm('Regular', 'text-[#dc2626]')}>Emergency floor: {BATTERY_POLICY.emergencyFloorSOC}%</span>
                  <span {...ibm('Regular', 'text-[#f59e0b]')}>Reserve: {config.limits.reserveSOC}%</span>
                  <span {...ibm('Regular', 'text-[#10b981]')}>Current: {flow.soc}%</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
                  {[
                    { label: 'Discharge rate', value: `${flow.battery} MW` },
                    { label: 'Usable above reserve', value: `${Math.max(0, (flow.soc - config.limits.reserveSOC) * 0.2).toFixed(1)} MWh` },
                    { label: 'Runtime remaining', value: `~${Math.round(Math.max(0, (flow.soc - config.limits.reserveSOC) * 0.2) / 6 * 60)} min energy runtime · ${Math.max(0, Math.round(flow.durationMinutes - flow.elapsedMinutes))} min action cap remaining` },
                  ].map(item => (
                    <div key={item.label} className="bg-[#f9fafb] p-3 rounded-[2px]">
                      <p {...ibm('Regular', 'text-[#525252] text-[11px]')}>{item.label}</p>
                      <p {...ibm('SemiBold', 'text-[#1f2937] text-[14px]')}>{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-[#0f62fe]"><Link to="/askBob">Ask BOB activity summary</Link><Link to="/actionDetails">View action details</Link><Link to="/audit">View evidence</Link><Link to="/protected">View protected boundary</Link><Link to="/workOrder">Open work order</Link><Link to="/connectData">Connect data</Link></div>
            {/* Audit event log */}
            <div className="bg-white border border-[#e5e7eb] p-5 rounded-[2px]">
              <p {...ibm('SemiBold', 'text-[#1f2937] text-[14px] mb-4')}>Audit event log</p>
              <div className="flex flex-col gap-0">
                {state.audit.map(entry => ({ time: entry.time, event: entry.title, detail: entry.detail, type: entry.title.includes("rejected") || entry.title.includes("expired") ? "error" : "success" })).map((entry, i) => (
                  <div key={i} className="flex gap-4 border-b border-[#f4f4f4] last:border-0 py-3">
                    <p {...ibm('Regular', 'text-[#94a3b8] text-[12px] whitespace-nowrap mt-0.5')}>{entry.time}</p>
                    <div>
                      <p {...ibm('SemiBold', `text-[13px] ${entry.type === 'error' ? 'text-[#dc2626]' : entry.type === 'warning' || entry.type === 'approval' ? 'text-[#e6a817]' : 'text-[#1f2937]'}`)}>{entry.event}</p>
                      <p {...ibm('Regular', 'text-[#525252] text-[12px] leading-normal')}>{entry.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Ask BOB panel */}
        {askBobOpen && (
          <div className="bg-white border-l border-[#e5e7eb] flex flex-col w-full lg:w-[360px] shrink-0">
            <div className="border-b border-[#e5e7eb] flex flex-wrap gap-3 items-center justify-between px-5 py-4">
              <div className="flex gap-2 items-center">
                <img alt="" className="size-4" src={imgBot} />
                <p {...ibm('SemiBold', 'text-[#1f2937] text-[14px]')}>Ask BOB</p>
              </div>
              <button onClick={() => setAskBobOpen(false)} className="hover:bg-[#f4f4f4] rounded-[2px] p-1 cursor-pointer">
                <img alt="" className="size-4" src={imgXCircle} />
              </button>
            </div>
            <BobChatScrollArea className="h-[55dvh] p-4" updateKey={`${chat.messages.length}:${chat.pending}:${chat.error}`} lastUserId={chat.messages.filter(message => message.role === 'user').at(-1)?.id}><BobMessages chat={chat} /></BobChatScrollArea>
            <BobComposer chat={chat} placeholder="Ask about battery, grid, or trigger…" />
          </div>
        )}
      </div>
    </div>
  );
}
