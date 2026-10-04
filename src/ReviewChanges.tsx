import { useOperations } from "./Operations";
import { BATTERY_POLICY, CONFIG_STEPS, STATE_COLOR, SITE, SNAPSHOT_14_32 } from './data';
import type { ActionConfig } from './AgentChat';

const assetPathPrefix = '/assets';
const imgBrainCog = `${assetPathPrefix}/71557.svg`;
const imgChevronDown = `${assetPathPrefix}/291fd.svg`;
const imgXCircle = `${assetPathPrefix}/179e0.svg`;
const imgCheck1 = `${assetPathPrefix}/f6f5a.svg`;
const imgArrowRight = `${assetPathPrefix}/21c0f.svg`;

interface ReviewChangesProps {
  config: ActionConfig;
  onBack: () => void;
  onEdit: (step: number) => void;
  onProceedToTest: () => void;
}

const PRIORITY_LABELS: Record<string, string> = {
  reliability: 'Maintain supply reliability',
  cost: 'Reduce grid purchase cost',
  peak: 'Avoid peak grid demand',
  renewable: 'Maximize renewable energy use',
};

const RECOVERY_LABELS: Record<string, string> = {
  'notify-and-hold': 'Notify operators and hold current state',
  'switch-battery': 'Switch to secondary battery if available',
  'request-import': 'Request grid import approval',
  'load-shed': 'Initiate load-shedding protocol',
};

const NOTIF_LABELS: Record<string, string> = {
  sms: 'SMS — Operations team',
  email: 'Email — Site managers',
  push: 'Push — Plug.ai mobile app',
  slack: 'Slack — #kuppam-ops channel',
};

function ibmSemi(extra = '') {
  return { className: `font-['IBM Plex Sans:SemiBold'] font-semibold ${extra}`, style: { fontVariationSettings: '"wdth" 100' } };
}

function Section({ title, step, onEdit, children }: { title: string; step: number; onEdit: (s: number) => void; children: React.ReactNode }) {
  return (
    <div className="border border-[#e5e7eb] rounded-[2px] overflow-hidden">
      <div className="bg-[#f9fafb] border-b border-[#e5e7eb] flex flex-wrap gap-3 items-center justify-between px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="bg-[#10b981] flex items-center justify-center rounded-full size-[18px]">
            <img alt="" className="size-3" src={imgCheck1} />
          </div>
          <p {...ibmSemi('text-[#1f2937] text-[14px]')}>{title}</p>
        </div>
        <button onClick={() => onEdit(step)} className="border border-[#e5e7eb] px-3 py-1.5 rounded-[2px] hover:bg-white transition-colors cursor-pointer">
          <p className="font-['IBM Plex Sans:Medium'] font-medium text-[#1f2937] text-[13px]" style={{ fontVariationSettings: '"wdth" 100' }}>Edit</p>
        </button>
      </div>
      <div className="bg-white px-5 py-4">{children}</div>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#525252] text-[13px]" style={{ fontVariationSettings: '"wdth" 100' }}>{label}</p>
      <p className={`font-['IBM Plex Sans:${highlight ? 'SemiBold' : 'Medium'}'] ${highlight ? 'font-semibold text-[#0f62fe]' : 'font-medium text-[#1f2937]'} text-[13px] text-right`} style={{ fontVariationSettings: '"wdth" 100' }}>{value}</p>
    </div>
  );
}

export default function ReviewChanges({ config, onBack, onEdit, onProceedToTest }: ReviewChangesProps) {
  const { flow } = useOperations();
  const { limits } = config;
  const usableMWh = Math.max(0, (flow.soc - limits.reserveSOC) * 0.2);
  // Runtime calculation: usable energy / autoMaxMW → capped by maxDuration
  const runtimeAtMax = Math.min(config.limits.maxDuration, config.limits.maxEnergyMWh / limits.autoMaxMW * 60, usableMWh / limits.autoMaxMW * 60);

  return (
    <div className="bg-[#f4f4f4] flex flex-col min-h-screen w-full">

      {/* Header */}
      <div className="bg-white border-b border-[#e5e7eb] flex min-h-14 flex-wrap gap-3 items-center justify-between py-3 px-6 shrink-0">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="bg-[#0f62fe] flex items-center justify-center rounded-[2px] size-8">
            <img alt="" className="size-5" src={imgBrainCog} />
          </div>
          <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#1f2937] text-[16px]" style={{ fontVariationSettings: '"wdth" 100' }}>BOB Agent Setup</p>
          <div className="border border-[#e5e7eb] flex gap-2 items-center px-2.5 py-1.5 rounded-[2px]">
            <p className="font-['IBM Plex Sans:Medium'] font-medium text-[#1f2937] text-[13px]" style={{ fontVariationSettings: '"wdth" 100' }}>{SITE.id}</p>
            <img alt="" className="size-3.5" src={imgChevronDown} />
          </div>
          <div className="bg-[#fff8e1] px-2 py-1 rounded-[2px]">
            <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#e6a817] text-[11px]" style={{ fontVariationSettings: '"wdth" 100' }}>Ready to test</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <p className="font-['IBM Plex Sans:Medium'] font-medium text-[#525252] text-[13px]" style={{ fontVariationSettings: '"wdth" 100' }}>All changes saved</p>
          <button onClick={onBack} className="border border-[#e5e7eb] px-3 py-1.5 rounded-[2px] hover:bg-[#f4f4f4] cursor-pointer">
            <p className="font-['IBM Plex Sans:Medium'] font-medium text-[#1f2937] text-[13px]" style={{ fontVariationSettings: '"wdth" 100' }}>Save and exit</p>
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
          { num: 3, label: 'Test', state: 'active' },
          { num: 4, label: 'Activate', state: 'pending' },
        ].map((s, i) => (
          <div key={s.num} className="flex flex-wrap gap-3 items-center">
            {i > 0 && <div className="bg-[#e5e7eb] h-px w-10" />}
            <div className="flex gap-2 items-center">
              <div className={`flex items-center justify-center rounded-full size-5 ${s.state === 'done' ? 'bg-[#0f62fe]' : s.state === 'active' ? 'bg-white border-2 border-[#0f62fe]' : 'bg-white border border-[#d1d5db]'}`}>
                <p className={`font-['IBM Plex Sans:SemiBold'] font-semibold text-[11px] ${s.state === 'done' ? 'text-white' : s.state === 'active' ? 'text-[#0f62fe]' : 'text-[#94a3b8]'}`} style={{ fontVariationSettings: '"wdth" 100' }}>{s.num}</p>
              </div>
              <p className={`font-['IBM Plex Sans:SemiBold'] font-semibold text-[13px] ${s.state === 'pending' ? 'text-[#94a3b8]' : 'text-[#0f62fe]'}`} style={{ fontVariationSettings: '"wdth" 100' }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-1 flex-col lg:flex-row min-w-0">
        {/* Main */}
        <div className="flex-1 min-w-0 overflow-y-auto p-4 md:p-8">
          <div className="max-w-2xl mx-auto flex flex-col gap-6">

            <div>
              <h1 className="font-['IBM Plex Sans:Bold'] font-bold text-[#1f2937] text-[22px] mb-1" style={{ fontVariationSettings: '"wdth" 100' }}>Review configuration</h1>
              <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#525252] text-[14px]" style={{ fontVariationSettings: '"wdth" 100' }}>
                All 7 settings are configured. Review each decision before running simulations. You can edit any setting and return here to re-review.
              </p>
            </div>

            <Section title="Objective" step={0} onEdit={onEdit}>
              <Row label="Priority" value={PRIORITY_LABELS[config.objective]} highlight />
            </Section>

            <Section title="Battery selection" step={1} onEdit={onEdit}>
              <Row label="Battery" value="Battery 1" />
              <Row label="Current SOC" value={`${flow.soc}%`} />
              <Row label="Usable energy above reserve" value={`${usableMWh.toFixed(1)} MWh`} />
              <Row label="Estimated runtime at max discharge" value={`~${Math.round(runtimeAtMax)} min (capped by ${limits.maxDuration}-min limit)`} />
            </Section>

            <Section title="Trigger conditions" step={2} onEdit={onEdit}>
              <Row label="Start when deficit exceeds" value={`${config.trigger.deficitMW} MW`} />
              <Row label="Sustained for" value={`${config.trigger.delayMin} min`} />
              <Row label="Battery SOC must be above" value={`${BATTERY_POLICY.startSOC}%`} />
            </Section>

            <Section title="Safety limits" step={3} onEdit={onEdit}>
              <Row label="Automatic discharge limit" value={`${limits.autoMaxMW} MW`} />
              <Row label="Configured reserve SOC" value={`${limits.reserveSOC}%`} />
              <Row label="Emergency floor SOC" value={`${BATTERY_POLICY.emergencyFloorSOC}% (locked — cannot be overridden)`} highlight />
              <Row label="Maximum duration" value={`${limits.maxDuration} min`} />
              <Row label="Maximum energy per action" value={`${limits.maxEnergyMWh} MWh`} />
            </Section>

            <Section title="Automation and approvals" step={4} onEdit={onEdit}>
              <Row label="Auto-start (no approval needed) up to" value={`${config.automation.approvalAboveMW} MW`} />
              <Row label="Approval required above" value={`${config.automation.approvalAboveMW} MW`} />
              <Row label="Approval expires after" value={`${config.automation.approvalExpiryMin} min`} />
            </Section>

            <Section title="Recovery behavior" step={5} onEdit={onEdit}>
              <Row label="If battery becomes unavailable" value={RECOVERY_LABELS[config.recovery] || config.recovery} />
            </Section>

            <Section title="Notifications" step={6} onEdit={onEdit}>
              {config.notifications.map(n => (
                <Row key={n} label="" value={NOTIF_LABELS[n] || n} />
              ))}
            </Section>

            {/* Action */}
            <div className="flex gap-3 pt-2">
              <button onClick={onProceedToTest} className="bg-[#0f62fe] flex items-center gap-2 px-6 py-3 rounded-[2px] hover:bg-[#0353e9] transition-colors cursor-pointer">
                <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-white text-[14px]" style={{ fontVariationSettings: '"wdth" 100' }}>Run required simulations</p>
                <img alt="" className="size-4" src={imgArrowRight} />
              </button>
              <button onClick={onBack} className="border border-[#e5e7eb] px-5 py-3 rounded-[2px] hover:bg-[#f9fafb] cursor-pointer">
                <p className="font-['IBM Plex Sans:Medium'] font-medium text-[#1f2937] text-[14px]" style={{ fontVariationSettings: '"wdth" 100' }}>Back to configure</p>
              </button>
            </div>
          </div>
        </div>

        {/* Right: Energy context */}
        <div className="bg-white border-l border-[#e5e7eb] flex flex-col shrink-0 w-full lg:w-[320px]">
          <div className="border-b border-[#e5e7eb] px-5 py-4">
            <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#1f2937] text-[15px]" style={{ fontVariationSettings: '"wdth" 100' }}>Site energy context</p>
            <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#525252] text-[13px] mt-0.5" style={{ fontVariationSettings: '"wdth" 100' }}>{flow.timestamp}</p>
          </div>
          <div className="flex flex-col gap-4 p-5">
            {[
              { label: 'Solar generation', value: `${flow.solar} MW`, color: '#f59e0b' },
              { label: 'Site demand', value: `${flow.demand} MW`, color: '#6366f1' },
              { label: 'Battery discharge', value: `${flow.battery} MW`, color: '#0f62fe' },
              { label: 'Grid import', value: `${flow.grid} MW`, color: '#94a3b8' },
              { label: 'Energy balance', value: `${flow.solar} + ${flow.battery} + ${flow.grid} = ${flow.solar + flow.battery + flow.grid} MW / ${flow.demand} MW demand${flow.deficit > 0 ? ` · ${flow.deficit} MW deficit` : " ✓"}`, color: '#10b981' },
            ].map(item => (
              <div key={item.label} className="flex flex-wrap gap-3 items-center justify-between">
                <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#525252] text-[13px]" style={{ fontVariationSettings: '"wdth" 100' }}>{item.label}</p>
                <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[14px]" style={{ color: item.color, fontVariationSettings: '"wdth" 100' }}>{item.value}</p>
              </div>
            ))}
            <div className="bg-[#e5e7eb] h-px w-full" />
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#525252] text-[13px]" style={{ fontVariationSettings: '"wdth" 100' }}>Battery SOC</p>
              <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#1f2937] text-[14px]" style={{ fontVariationSettings: '"wdth" 100' }}>{flow.soc}%</p>
            </div>
            <div className="bg-[#f4f4f4] rounded-full h-2 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${flow.soc}%`, background: 'linear-gradient(90deg, #10b981, #0f62fe)' }} />
            </div>
            <div className="flex justify-between">
              <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#94a3b8] text-[11px]" style={{ fontVariationSettings: '"wdth" 100' }}>Emergency floor: {BATTERY_POLICY.emergencyFloorSOC}%</p>
              <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#94a3b8] text-[11px]" style={{ fontVariationSettings: '"wdth" 100' }}>Reserve: {limits.reserveSOC}%</p>
            </div>
            <div className="bg-[#e8f1ff] p-3 rounded-[2px]">
              <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#0f62fe] text-[12px] mb-1" style={{ fontVariationSettings: '"wdth" 100' }}>At {flow.timestamp}</p>
              <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#1e3a8a] text-[12px] leading-relaxed" style={{ fontVariationSettings: '"wdth" 100' }}>
                The pre-battery deficit is {flow.demand - flow.solar} MW. Activation and execution still require the {config.trigger.delayMin}-minute persistence window, SOC above 60%, verified permissions, and all safety checks.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
