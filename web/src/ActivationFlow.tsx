import { useState } from 'react';
import { BATTERY_POLICY, SITE, SNAPSHOT_14_32 } from './data';
import type { ActionConfig } from './AgentChat';
import { useOperations } from './Operations';

const assetPathPrefix = '/assets';
const imgBrainCog = `${assetPathPrefix}/71557.svg`;
const imgChevronDown = `${assetPathPrefix}/291fd.svg`;
const imgXCircle = `${assetPathPrefix}/179e0.svg`;
const imgCheck1 = `${assetPathPrefix}/f6f5a.svg`;
const imgArrowRight = `${assetPathPrefix}/21c0f.svg`;
const imgEllipse = `${assetPathPrefix}/2ea7c.svg`;

const PRIORITY_LABELS: Record<string, string> = {
  reliability: 'Maintain supply reliability',
  cost: 'Reduce grid purchase cost',
  peak: 'Avoid peak grid demand',
  renewable: 'Maximize renewable energy use',
};

type Phase = 'finalReview' | 'confirm' | 'success';

interface ActivationFlowProps {
  config: ActionConfig;
  onBack: () => void;
  onActivated: () => void;
}

function ibm(w: 'Regular' | 'Medium' | 'SemiBold' | 'Bold', extra = '') {
  const wMap = { Regular: 'font-normal', Medium: 'font-medium', SemiBold: 'font-semibold', Bold: 'font-bold' };
  return { className: `font-sans ${wMap[w]} ${extra}` };
}

export default function ActivationFlow({ config, onBack, onActivated }: ActivationFlowProps) {
  const operations = useOperations();
  const [phase, setPhase] = useState<Phase>(() => operations.state.activated && JSON.stringify(operations.state.activeConfig) === JSON.stringify(config) && ['Active', 'Executing'].includes(operations.state.stage) ? 'success' : 'finalReview');
  const [activating, setActivating] = useState(false);

  const handleActivate = () => {
    if (!operations.activate()) return;
    setPhase('success');
  };

  if (phase === 'success') {
    return (
      <div className="bg-[#f4f4f4] flex flex-col min-h-screen w-full items-center justify-center font-sans">
        <div className="bg-white border border-[#e0e0e0] flex flex-col items-center gap-6 max-w-lg p-6 md:p-12 rounded-[2px] text-center shadow-sm">
          <div className="bg-[#198038] flex items-center justify-center rounded-[2px] size-16">
            <img alt="" className="size-8" src={imgCheck1} />
          </div>
          <div>
            <p {...ibm('Bold', 'text-[#161616] text-[22px] mb-2')}>Action activated</p>
            <p {...ibm('Regular', 'text-[#525252] text-[15px] leading-relaxed')}>
              "Support demand using Battery 1" is now <strong className="text-[#161616]">Active</strong>. BOB is monitoring {SITE.name} and will discharge Battery 1 automatically when the trigger conditions are met.
            </p>
          </div>
          <div className="bg-[#defbe6] border border-[#198038]/40 flex flex-col gap-2 p-4 rounded-[2px] w-full text-left">
            <div className="flex items-center gap-2">
              <img alt="" className="size-1.5" src={imgEllipse} />
              <p {...ibm('SemiBold', 'text-[#198038] text-[13px]')}>Monitoring active</p>
            </div>
            <p {...ibm('Regular', 'text-[#0e6027] text-[12px] leading-relaxed')}>
              Current: Solar <span className="font-mono font-semibold">{operations.flow.solar} MW</span> · Demand <span className="font-mono font-semibold">{operations.flow.demand} MW</span> · Battery discharging at <span className="font-mono font-semibold">{operations.flow.battery} MW</span>
            </p>
          </div>
          <button onClick={onActivated} className="min-h-11 bg-[#0f62fe] hover:bg-[#0043ce] transition-colors rounded-[2px] px-5 py-3 text-sm font-semibold text-white cursor-pointer">Open active monitoring</button>
        </div>
      </div>
    );
  }

  if (phase === 'confirm') {
    return (
      <div className="bg-[#f4f4f4] flex flex-col min-h-screen w-full items-center justify-center font-sans">
        <div className="bg-white border border-[#e0e0e0] flex flex-col gap-6 max-w-lg p-8 rounded-[2px] shadow-sm">
          <div>
            <p {...ibm('Bold', 'text-[#161616] text-[20px] mb-1')}>Confirm activation</p>
            <p {...ibm('Regular', 'text-[#525252] text-[14px] leading-relaxed')}>
              Once confirmed, this configuration becomes active in the operational preview at {SITE.name}. No real equipment commands are sent until an authorized backend is connected.
            </p>
          </div>

          <div className="bg-[#fef3c7] border border-[#f59e0b]/50 p-4 rounded-[2px]">
            <p {...ibm('SemiBold', 'text-[#78350f] text-[13px] mb-2')}>Before you activate</p>
            <ul className="flex flex-col gap-1.5">
              {[
                'All 7 simulations passed successfully',
                `Battery 1 is available at ${operations.flow.soc}% SOC`,
                `Automatic limit: ${config.limits.autoMaxMW} MW — above this requires approval`,
                `Emergency floor: ${BATTERY_POLICY.emergencyFloorSOC}% SOC is locked`,
                `Approval expires after ${config.automation.approvalExpiryMin} minutes`,
              ].map(item => (
                <li key={item} className="flex gap-2 items-start">
                  <span className="text-[#b26207] mt-0.5">•</span>
                  <p {...ibm('Regular', 'text-[#78350f] text-[13px] leading-normal')}>{item}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex gap-3">
            <button onClick={handleActivate} disabled={activating}
              className="bg-[#198038] flex items-center gap-2 px-6 py-3 rounded-[2px] hover:bg-[#0e6027] transition-colors cursor-pointer disabled:opacity-70 text-white">
              {activating ? (
                <p {...ibm('SemiBold', 'text-white text-[14px]')}>Activating…</p>
              ) : (
                <>
                  <p {...ibm('SemiBold', 'text-white text-[14px]')}>Activate action</p>
                  <img alt="" className="size-4" src={imgArrowRight} />
                </>
              )}
            </button>
            <button onClick={() => setPhase('finalReview')}
              className="border border-[#e0e0e0] bg-white px-5 py-3 rounded-[2px] hover:bg-[#f4f4f4] transition-colors cursor-pointer">
              <p {...ibm('Medium', 'text-[#161616] text-[14px]')}>Back</p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Final review
  return (
    <div className="bg-[#f4f4f4] flex flex-col min-h-screen w-full font-sans">

      {/* Header */}
      <div className="bg-white border-b border-[#e0e0e0] flex min-h-14 flex-wrap gap-3 items-center justify-between py-3 px-6 shrink-0">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="bg-[#0f62fe] flex items-center justify-center rounded-[2px] size-8">
            <img alt="" className="size-5" src={imgBrainCog} />
          </div>
          <p {...ibm('SemiBold', 'text-[#161616] text-[16px]')}>BOB Agent Setup</p>
          <div className="border border-[#e0e0e0] flex gap-2 items-center px-2.5 py-1.5 rounded-[2px] bg-[#f4f4f4]">
            <p {...ibm('Medium', 'text-[#161616] font-mono text-[13px]')}>{SITE.id}</p>
            <img alt="" className="size-3.5" src={imgChevronDown} />
          </div>
          <div className="bg-[#defbe6] border border-[#198038]/40 px-2 py-1 rounded-[2px]">
            <p {...ibm('SemiBold', 'text-[#198038] text-[11px] font-mono tracking-tight')}>Ready to activate</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <p {...ibm('Medium', 'text-[#525252] text-[13px]')}>All changes saved</p>
          <button onClick={onBack} className="border border-[#e0e0e0] px-3 py-1.5 rounded-[2px] hover:bg-[#f4f4f4] transition-colors cursor-pointer">
            <p {...ibm('Medium', 'text-[#161616] text-[13px]')}>Save and exit</p>
          </button>
          <button onClick={onBack} className="border border-[#e0e0e0] flex items-center justify-center rounded-[2px] size-8 hover:bg-[#f4f4f4] transition-colors cursor-pointer">
            <img alt="" className="size-4" src={imgXCircle} />
          </button>
        </div>
      </div>

      {/* Step progress */}
      <div className="bg-white border-b border-[#e0e0e0] flex flex-wrap gap-3 items-center px-4 md:px-6 py-4 shrink-0">
        {[
          { num: 1, label: 'Select action', state: 'done' },
          { num: 2, label: 'Configure', state: 'done' },
          { num: 3, label: 'Test', state: 'done' },
          { num: 4, label: 'Activate', state: 'active' },
        ].map((s, i) => (
          <div key={s.num} className="flex flex-wrap gap-3 items-center">
            {i > 0 && <div className="bg-[#e0e0e0] h-px w-10" />}
            <div className="flex gap-2 items-center">
              <div className={`flex items-center justify-center rounded-[2px] size-5 font-mono text-[11px] ${s.state === 'done' ? 'bg-[#0f62fe] text-white font-semibold' : s.state === 'active' ? 'bg-white border-2 border-[#198038] text-[#198038] font-bold' : 'bg-white border border-[#e0e0e0] text-[#8d8d8d]'}`}>
                {s.num}
              </div>
              <p className={`font-sans font-semibold text-[13px] ${s.state === 'pending' ? 'text-[#8d8d8d]' : s.state === 'active' ? 'text-[#198038]' : 'text-[#0f62fe]'}`}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-1 flex-col lg:flex-row min-w-0">
        <div className="flex-1 min-w-0 overflow-y-auto p-4 md:p-8">
          <div className="max-w-2xl mx-auto flex flex-col gap-6">

            <div>
              <h1 {...ibm('Bold', 'text-[#161616] text-[22px] mb-1')}>Final review</h1>
              <p {...ibm('Regular', 'text-[#525252] text-[14px]')}>
                All simulations passed. Review this summary before activating.
              </p>
            </div>

            {/* Test results */}
            <div className="bg-[#defbe6] border border-[#198038]/40 flex gap-3 items-center p-4 rounded-[2px]">
              <div className="bg-[#198038] flex items-center justify-center rounded-[2px] size-5 shrink-0">
                <img alt="" className="size-3" src={imgCheck1} />
              </div>
              <div>
                <p {...ibm('SemiBold', 'text-[#198038] text-[13px]')}>7 of 7 simulations passed</p>
                <p {...ibm('Regular', 'text-[#0e6027] text-[12px]')}>All safety blocks, trigger conditions, and recovery behaviors verified.</p>
              </div>
            </div>

            {/* Action summary */}
            <div className="bg-white border border-[#e0e0e0] rounded-[2px] overflow-hidden">
              <div className="bg-[#f4f4f4] border-b border-[#e0e0e0] px-5 py-3">
                <p {...ibm('SemiBold', 'text-[#161616] text-[14px]')}>Support demand using Battery 1</p>
              </div>
              <div className="px-5 py-4 flex flex-col gap-2">
                {[
                  ['Objective', PRIORITY_LABELS[config.objective]],
                  ['Battery', `Battery 1 (SOC: ${operations.flow.soc}%)`],
                  ['Trigger', `Deficit > ${config.trigger.deficitMW} MW for ${config.trigger.delayMin} min`],
                  ['Discharge limit', `${config.limits.autoMaxMW} MW (auto) · ${BATTERY_POLICY.equipmentMaxMW} MW (equipment max)`],
                  ['Reserve SOC', `${config.limits.reserveSOC}% (stop) · ${BATTERY_POLICY.emergencyFloorSOC}% (locked floor)`],
                  ['Duration limit', `${config.limits.maxDuration} min · ${config.limits.maxEnergyMWh} MWh max`],
                  ['Approval gate', `Above ${config.automation.approvalAboveMW} MW · expires ${config.automation.approvalExpiryMin} min`],
                ].map(([label, value]) => (
                  <div key={label} className="flex flex-wrap gap-3 items-center justify-between gap-4 py-1.5 border-b border-[#f4f4f4] last:border-0">
                    <p {...ibm('Regular', 'text-[#525252] text-[13px]')}>{label}</p>
                    <p {...ibm('Medium', 'text-[#161616] font-mono text-[13px] text-right')}>{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Live context */}
            <div className="bg-white border border-[#e0e0e0] p-5 rounded-[2px]">
              <p {...ibm('SemiBold', 'text-[#161616] text-[14px] mb-3')}>Current site state · <span className="font-mono">{operations.flow.timestamp}</span></p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: 'Solar', value: `${operations.flow.solar} MW` },
                  { label: 'Demand', value: `${operations.flow.demand} MW` },
                  { label: 'Battery discharging', value: `${operations.flow.battery} MW` },
                  { label: 'Grid import', value: `${operations.flow.grid} MW` },
                ].map(item => (
                  <div key={item.label} className="bg-[#f4f4f4] border border-[#e0e0e0] p-3 rounded-[2px]">
                    <p {...ibm('Regular', 'text-[#525252] text-[12px]')}>{item.label}</p>
                    <p {...ibm('Bold', 'text-[#161616] font-mono text-[18px]')}>{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="bg-[#edf5ff] border border-[#a6c8ff]/60 p-3 rounded-[2px] mt-3">
                <p {...ibm('Regular', 'text-[#0043ce] text-[12px] leading-relaxed')}>
                  The pre-battery deficit is <span className="font-mono font-semibold">{operations.flow.demand - operations.flow.solar} MW</span>. The action remains <strong>Ready to activate</strong> until confirmation; execution also requires the persistence window, SOC above 60%, and fresh, safe telemetry.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setPhase('confirm')} className="bg-[#198038] flex items-center gap-2 px-6 py-3 rounded-[2px] hover:bg-[#0e6027] transition-colors cursor-pointer text-white">
                <p {...ibm('SemiBold', 'text-white text-[14px]')}>Activate this action</p>
                <img alt="" className="size-4" src={imgArrowRight} />
              </button>
              <button onClick={onBack} className="border border-[#e0e0e0] bg-white px-5 py-3 rounded-[2px] hover:bg-[#f4f4f4] transition-colors cursor-pointer">
                <p {...ibm('Medium', 'text-[#161616] text-[14px]')}>Back to simulations</p>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
