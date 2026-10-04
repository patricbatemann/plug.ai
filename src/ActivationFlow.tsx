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
  const wMap = { Regular: 'normal', Medium: 'medium', SemiBold: 'semibold', Bold: 'bold' };
  return { className: `font-['IBM Plex Sans:${w}'] font-${wMap[w]} ${extra}`, style: { fontVariationSettings: '"wdth" 100' } };
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
      <div className="bg-[#f4f4f4] flex flex-col min-h-screen w-full items-center justify-center">
        <div className="bg-white border border-[#e5e7eb] flex flex-col items-center gap-6 max-w-lg p-6 md:p-12 rounded-[2px] text-center">
          <div className="bg-[#10b981] flex items-center justify-center rounded-full size-16">
            <img alt="" className="size-8" src={imgCheck1} />
          </div>
          <div>
            <p {...ibm('Bold', 'text-[#1f2937] text-[22px] mb-2')}>Action activated</p>
            <p {...ibm('Regular', 'text-[#525252] text-[15px] leading-relaxed')}>
              "Support demand using Battery 1" is now <strong>Active</strong>. BOB is monitoring {SITE.name} and will discharge Battery 1 automatically when the trigger conditions are met.
            </p>
          </div>
          <div className="bg-[#e6f4ea] flex flex-col gap-2 p-4 rounded-[2px] w-full text-left">
            <div className="flex items-center gap-2">
              <img alt="" className="size-1.5" src={imgEllipse} />
              <p {...ibm('SemiBold', 'text-[#1a7f37] text-[13px]')}>Monitoring active</p>
            </div>
            <p {...ibm('Regular', 'text-[#166534] text-[12px] leading-relaxed')}>
              Current: Solar {operations.flow.solar} MW · Demand {operations.flow.demand} MW · Battery discharging at {operations.flow.battery} MW
            </p>
          </div>
          <button onClick={onActivated} className="min-h-11 bg-[#0f62fe] px-5 py-3 text-sm text-white">Open active monitoring</button>
        </div>
      </div>
    );
  }

  if (phase === 'confirm') {
    return (
      <div className="bg-[#f4f4f4] flex flex-col min-h-screen w-full items-center justify-center">
        <div className="bg-white border border-[#e5e7eb] flex flex-col gap-6 max-w-lg p-8 rounded-[2px]">
          <div>
            <p {...ibm('Bold', 'text-[#1f2937] text-[20px] mb-1')}>Confirm activation</p>
            <p {...ibm('Regular', 'text-[#525252] text-[14px] leading-relaxed')}>
              Once confirmed, this configuration becomes active in the operational preview at {SITE.name}. No real equipment commands are sent until an authorized backend is connected.
            </p>
          </div>

          <div className="bg-[#fff8e1] border border-[#fcd34d]/40 p-4 rounded-[2px]">
            <p {...ibm('SemiBold', 'text-[#92400e] text-[13px] mb-2')}>Before you activate</p>
            <ul className="flex flex-col gap-1.5">
              {[
                'All 7 simulations passed successfully',
                `Battery 1 is available at ${operations.flow.soc}% SOC`,
                `Automatic limit: ${config.limits.autoMaxMW} MW — above this requires approval`,
                `Emergency floor: ${BATTERY_POLICY.emergencyFloorSOC}% SOC is locked`,
                `Approval expires after ${config.automation.approvalExpiryMin} minutes`,
              ].map(item => (
                <li key={item} className="flex gap-2 items-start">
                  <span className="text-[#e6a817] mt-0.5">•</span>
                  <p {...ibm('Regular', 'text-[#78350f] text-[13px] leading-normal')}>{item}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex gap-3">
            <button onClick={handleActivate} disabled={activating}
              className="bg-[#10b981] flex items-center gap-2 px-6 py-3 rounded-[2px] hover:bg-[#059669] transition-colors cursor-pointer disabled:opacity-70">
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
              className="border border-[#e5e7eb] px-5 py-3 rounded-[2px] hover:bg-[#f9fafb] cursor-pointer">
              <p {...ibm('Medium', 'text-[#1f2937] text-[14px]')}>Back</p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Final review
  return (
    <div className="bg-[#f4f4f4] flex flex-col min-h-screen w-full">

      {/* Header */}
      <div className="bg-white border-b border-[#e5e7eb] flex min-h-14 flex-wrap gap-3 items-center justify-between py-3 px-6 shrink-0">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="bg-[#0f62fe] flex items-center justify-center rounded-[2px] size-8">
            <img alt="" className="size-5" src={imgBrainCog} />
          </div>
          <p {...ibm('SemiBold', 'text-[#1f2937] text-[16px]')}>BOB Agent Setup</p>
          <div className="border border-[#e5e7eb] flex gap-2 items-center px-2.5 py-1.5 rounded-[2px]">
            <p {...ibm('Medium', 'text-[#1f2937] text-[13px]')}>{SITE.id}</p>
            <img alt="" className="size-3.5" src={imgChevronDown} />
          </div>
          <div className="bg-[#e6f4ea] px-2 py-1 rounded-[2px]">
            <p {...ibm('SemiBold', 'text-[#1a7f37] text-[11px]')}>Ready to activate</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <p {...ibm('Medium', 'text-[#525252] text-[13px]')}>All changes saved</p>
          <button onClick={onBack} className="border border-[#e5e7eb] px-3 py-1.5 rounded-[2px] hover:bg-[#f4f4f4] cursor-pointer">
            <p {...ibm('Medium', 'text-[#1f2937] text-[13px]')}>Save and exit</p>
          </button>
          <button onClick={onBack} className="border border-[#e5e7eb] flex items-center justify-center rounded-[2px] size-8 hover:bg-[#f4f4f4] cursor-pointer">
            <img alt="" className="size-4" src={imgXCircle} />
          </button>
        </div>
      </div>

      {/* Step progress */}
      <div className="bg-white border-b border-[#e5e7eb] flex flex-wrap gap-3 items-center px-4 md:px-6 py-4 shrink-0">
        {[
          { num: 1, label: 'Select action', state: 'done' },
          { num: 2, label: 'Configure', state: 'done' },
          { num: 3, label: 'Test', state: 'done' },
          { num: 4, label: 'Activate', state: 'active' },
        ].map((s, i) => (
          <div key={s.num} className="flex flex-wrap gap-3 items-center">
            {i > 0 && <div className="bg-[#e5e7eb] h-px w-10" />}
            <div className="flex gap-2 items-center">
              <div className={`flex items-center justify-center rounded-full size-5 ${s.state === 'done' ? 'bg-[#0f62fe]' : s.state === 'active' ? 'bg-white border-2 border-[#10b981]' : 'bg-white border border-[#d1d5db]'}`}>
                <p className={`font-['IBM Plex Sans:SemiBold'] font-semibold text-[11px] ${s.state === 'done' ? 'text-white' : s.state === 'active' ? 'text-[#10b981]' : 'text-[#94a3b8]'}`} style={{ fontVariationSettings: '"wdth" 100' }}>{s.num}</p>
              </div>
              <p className={`font-['IBM Plex Sans:SemiBold'] font-semibold text-[13px] ${s.state === 'pending' ? 'text-[#94a3b8]' : s.state === 'active' ? 'text-[#10b981]' : 'text-[#0f62fe]'}`} style={{ fontVariationSettings: '"wdth" 100' }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-1 flex-col lg:flex-row min-w-0">
        <div className="flex-1 min-w-0 overflow-y-auto p-4 md:p-8">
          <div className="max-w-2xl mx-auto flex flex-col gap-6">

            <div>
              <h1 {...ibm('Bold', 'text-[#1f2937] text-[22px] mb-1')}>Final review</h1>
              <p {...ibm('Regular', 'text-[#525252] text-[14px]')}>
                All simulations passed. Review this summary before activating.
              </p>
            </div>

            {/* Test results */}
            <div className="bg-[#e6f4ea] border border-[#10b981]/30 flex gap-3 items-center p-4 rounded-[2px]">
              <div className="bg-[#10b981] flex items-center justify-center rounded-full size-5 shrink-0">
                <img alt="" className="size-3" src={imgCheck1} />
              </div>
              <div>
                <p {...ibm('SemiBold', 'text-[#1a7f37] text-[13px]')}>7 of 7 simulations passed</p>
                <p {...ibm('Regular', 'text-[#166534] text-[12px]')}>All safety blocks, trigger conditions, and recovery behaviors verified.</p>
              </div>
            </div>

            {/* Action summary */}
            <div className="bg-white border border-[#e5e7eb] rounded-[2px] overflow-hidden">
              <div className="bg-[#f9fafb] border-b border-[#e5e7eb] px-5 py-3">
                <p {...ibm('SemiBold', 'text-[#1f2937] text-[14px]')}>Support demand using Battery 1</p>
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
                  <div key={label} className="flex flex-wrap gap-3 items-center justify-between gap-4 py-1 border-b border-[#f4f4f4] last:border-0">
                    <p {...ibm('Regular', 'text-[#525252] text-[13px]')}>{label}</p>
                    <p {...ibm('Medium', 'text-[#1f2937] text-[13px] text-right')}>{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Live context */}
            <div className="bg-white border border-[#e5e7eb] p-5 rounded-[2px]">
              <p {...ibm('SemiBold', 'text-[#1f2937] text-[14px] mb-3')}>Current site state · {operations.flow.timestamp}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: 'Solar', value: `${operations.flow.solar} MW` },
                  { label: 'Demand', value: `${operations.flow.demand} MW` },
                  { label: 'Battery discharging', value: `${operations.flow.battery} MW` },
                  { label: 'Grid import', value: `${operations.flow.grid} MW` },
                ].map(item => (
                  <div key={item.label} className="bg-[#f9fafb] p-3 rounded-[2px]">
                    <p {...ibm('Regular', 'text-[#525252] text-[12px]')}>{item.label}</p>
                    <p {...ibm('Bold', 'text-[#1f2937] text-[18px]')}>{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="bg-[#e8f1ff] p-3 rounded-[2px] mt-3">
                <p {...ibm('Regular', 'text-[#1e3a8a] text-[12px] leading-relaxed')}>
                  The pre-battery deficit is {operations.flow.demand - operations.flow.solar} MW. The action remains <strong>Ready to activate</strong> until confirmation; execution also requires the persistence window, SOC above 60%, and fresh, safe telemetry.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setPhase('confirm')} className="bg-[#10b981] flex items-center gap-2 px-6 py-3 rounded-[2px] hover:bg-[#059669] transition-colors cursor-pointer">
                <p {...ibm('SemiBold', 'text-white text-[14px]')}>Activate this action</p>
                <img alt="" className="size-4" src={imgArrowRight} />
              </button>
              <button onClick={onBack} className="border border-[#e5e7eb] px-5 py-3 rounded-[2px] hover:bg-[#f9fafb] cursor-pointer">
                <p {...ibm('Medium', 'text-[#1f2937] text-[14px]')}>Back to simulations</p>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
