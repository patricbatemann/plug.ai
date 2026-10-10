import { useState, useEffect, useRef, createContext, useContext } from 'react';
import { BATTERY_POLICY, CONFIG_STEPS, STATE_COLOR, SITE, SNAPSHOT_14_32, type ActionState } from './data';

import { useBobChat, BobMessages, BobComposer, BobChatScrollArea, BobNewChat } from './BobChat';
import { Link } from 'react-router';
import { policyErrors, useOperations } from './Operations';

const BobAskContext = createContext<(text: string) => void>(() => {});
const BoundaryContext = createContext<(rule: string) => void>(() => {});

const assetPathPrefix = '/assets';
const imgBrainCog = `${assetPathPrefix}/71557.svg`;
const imgChevronDown = `${assetPathPrefix}/291fd.svg`;
const imgEllipse = `${assetPathPrefix}/2ea7c.svg`;
const imgXCircle = `${assetPathPrefix}/179e0.svg`;
const imgBattery = `${assetPathPrefix}/2951d.svg`;
const imgZap = `${assetPathPrefix}/eee89.svg`;
const imgPlug = `${assetPathPrefix}/8b4e5.svg`;
const imgToolbox = `${assetPathPrefix}/e087a.svg`;
const imgCheck = `${assetPathPrefix}/a0519.svg`;
const imgArrowRight = `${assetPathPrefix}/21c0f.svg`;
const imgCheck1 = `${assetPathPrefix}/f6f5a.svg`;
const imgFrame1 = `${assetPathPrefix}/10ff0.svg`;
const imgBot = `${assetPathPrefix}/0d037.svg`;

import { DEFAULT_CONFIG, type ActionConfig } from "./ActionConfig";
export { DEFAULT_CONFIG, type ActionConfig } from "./ActionConfig";

interface AgentChatProps {
  onClose: () => void;
  onComplete: (config: ActionConfig) => void;
}

type ConfigStep = 0 | 1 | 2 | 3 | 4 | 5 | 6; // maps to CONFIG_STEPS indices
type ChatPhase = 'welcome' | 'configuring' | 'done';

const PRIORITIES = [
  { id: 'reliability', label: 'Maintain supply reliability', recommended: true },
  { id: 'cost', label: 'Reduce grid purchase cost', recommended: false },
  { id: 'peak', label: 'Avoid peak grid demand', recommended: false },
  { id: 'renewable', label: 'Maximize renewable energy use', recommended: false },
];

const PRIORITY_LABELS: Record<string, string> = {
  reliability: 'Maintain supply reliability',
  cost: 'Reduce grid purchase cost',
  peak: 'Avoid peak grid demand',
  renewable: 'Maximize renewable energy use',
};

const RECOVERY_OPTIONS = [
  { id: 'notify-and-hold', label: 'Notify and hold current state', recommended: true },
  { id: 'switch-battery', label: 'Switch to secondary battery if available', recommended: false },
  { id: 'request-import', label: 'Request grid import approval', recommended: false },
  { id: 'load-shed', label: 'Initiate load-shedding protocol', recommended: false },
];

function StatusBadge({ state }: { state: ActionState }) {
  const c = STATE_COLOR[state];
  return (
    <div className="px-2 py-1 rounded-[2px]" style={{ backgroundColor: c.bg }}>
      <p className="font-sans font-semibold text-[11px] whitespace-nowrap" style={{ color: c.text }}>{state}</p>
    </div>
  );
}

function BobAvatar({ small = false }: { small?: boolean }) {
  const sz = small ? 'size-7 rounded-[2px]' : 'size-8 rounded-[2px]';
  return (
    <div className={`bg-[#0f62fe] flex items-center justify-center shrink-0 ${sz}`}>
      <img alt="" className={small ? 'size-4' : 'size-5'} src={small ? imgBot : imgBrainCog} />
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end w-full font-sans">
      <div className="bg-[#e0e0e0] px-4 py-3 rounded-[2px] max-w-[70%] min-w-0 [overflow-wrap:anywhere] border border-[#e0e0e0]">
        <p className="font-sans font-medium text-[#161616] text-[14px] leading-normal">{text}</p>
      </div>
    </div>
  );
}

function ConfirmRow({ label }: { label: string }) {
  return (
    <div className="flex flex-wrap gap-3 items-center font-sans">
      <div className="bg-[#198038] flex items-center justify-center rounded-[2px] size-[18px] shrink-0">
        <img alt="" className="size-3" src={imgCheck} />
      </div>
      <p className="font-sans font-semibold text-[#161616] text-[14px] leading-normal">{label}</p>
    </div>
  );
}

function SectionLabel({ text }: { text: string }) {
  return <p className="font-sans font-normal text-[#8d8d8d] text-[11px] uppercase tracking-wide">{text}</p>;
}

function ibm(weight: 'Regular' | 'Medium' | 'SemiBold' | 'Bold' = 'Regular') {
  const wMap = { Regular: 'font-normal', Medium: 'font-medium', SemiBold: 'font-semibold', Bold: 'font-bold' };
  return { className: `font-sans ${wMap[weight]}` };
}

export default function AgentChat({ onClose, onComplete }: AgentChatProps) {
  const operations = useOperations();
  const [boundary, setBoundary] = useState('');
  const [phase, setPhase] = useState<ChatPhase>(() => !operations.state.started ? 'welcome' : operations.state.confirmed.length === 7 ? 'done' : 'configuring');
  const [activeStep, setActiveStep] = useState<ConfigStep>(() => operations.state.step as ConfigStep);
  const [confirmed, setConfirmed] = useState<Set<ConfigStep>>(() => new Set(operations.state.confirmed as ConfigStep[]));
  const [config, setConfig] = useState<ActionConfig>(() => structuredClone(operations.state.config));
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [chatDraft, setChatDraft] = useState('');
  const assistantDialog = useRef<HTMLDialogElement>(null);
  const assistantTrigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const dialog = assistantDialog.current;
    if (assistantOpen && dialog && !dialog.open) dialog.showModal();
    if (!assistantOpen && dialog?.open) dialog.close();
  }, [assistantOpen]);
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)');
    const closeDrawer = () => { if (desktop.matches) setAssistantOpen(false); };
    desktop.addEventListener('change', closeDrawer);
    return () => desktop.removeEventListener('change', closeDrawer);
  }, []);
  const chat = useBobChat('configuration');
  useEffect(() => { operations.saveConfig(config, activeStep, [...confirmed], phase !== 'welcome'); }, [phase, activeStep, confirmed, config]);

  const confirmStep = (step: ConfigStep) => {
    setConfirmed(prev => new Set(prev).add(step));
    if (step < 6) {
      setActiveStep((step + 1) as ConfigStep);
    } else {
      setPhase('done');
    }
  };

  const isConfirmed = (s: ConfigStep) => confirmed.has(s);

  const actionState: ActionState = phase === 'done' ? operations.state.stage : phase === 'welcome' ? 'Draft' : 'Configuring';
  const configuredCount = confirmed.size;

  // Right panel item status
  const itemStatus = (i: number): 'done' | 'inProgress' | 'missing' => {
    if (confirmed.has(i as ConfigStep)) return 'done';
    if (i === activeStep && phase === 'configuring') return 'inProgress';
    return 'missing';
  };

  const conversation = <>
    {phase !== 'welcome' && <UserBubble text="Configure battery discharge to support demand." />}
    {isConfirmed(0) && <><UserBubble text={`Prioritize ${PRIORITY_LABELS[config.objective].toLowerCase()}.`} /><div className="flex gap-3 items-start w-full">
                      <BobAvatar small />
                      <ConfirmBubble text={`Configured. I'll prioritize ${PRIORITY_LABELS[config.objective].toLowerCase()} while protecting the battery reserve.`} />
                    </div></>}
    {isConfirmed(1) && <><UserBubble text="Use Battery 1." /><div className="flex gap-3 items-start w-full">
                      <BobAvatar small />
                      <ConfirmBubble text="Configured. Battery 1 is selected. Now let's set the trigger conditions." />
                    </div></>}
    {isConfirmed(2) && <><UserBubble text={`Start when demand exceeds solar by more than ${config.trigger.deficitMW} MW for ${config.trigger.delayMin} minutes.`} /><div className="flex gap-3 items-start w-full">
                      <BobAvatar small />
                      <ConfirmBubble text={`Configured. Discharge starts when deficit exceeds ${config.trigger.deficitMW} MW sustained for ${config.trigger.delayMin} minutes.`} />
                    </div></>}
    {isConfirmed(3) && <><UserBubble text={`Max ${config.limits.autoMaxMW} MW, stop at ${config.limits.reserveSOC}% SOC, ${config.limits.maxDuration} min limit.`} /><div className="flex gap-3 items-start w-full">
                      <BobAvatar small />
                      <ConfirmBubble text={`Configured. Discharge is capped at ${config.limits.autoMaxMW} MW, stops at ${config.limits.reserveSOC}% reserve, max ${config.limits.maxDuration} min / ${config.limits.maxEnergyMWh} MWh per action.`} />
                    </div></>}
    {isConfirmed(4) && <><UserBubble text={`Auto-start up to ${config.automation.approvalAboveMW} MW. Approval required above that. Approval expires after ${config.automation.approvalExpiryMin} minutes.`} /><div className="flex gap-3 items-start w-full">
                      <BobAvatar small />
                      <ConfirmBubble text={`Configured. Automatic up to ${config.automation.approvalAboveMW} MW. I'll request administrator approval for anything above, expiring after ${config.automation.approvalExpiryMin} minutes.`} />
                    </div></>}
    {isConfirmed(5) && <><UserBubble text={`Recovery: ${RECOVERY_OPTIONS.find(option => option.id === config.recovery)?.label}.`} /><div className="flex gap-3 items-start w-full">
                      <BobAvatar small />
                      <ConfirmBubble text={`Configured recovery: ${RECOVERY_OPTIONS.find(option => option.id === config.recovery)?.label}. Unsafe discharge is stopped; fallback execution still requires verified permissions and safety checks.`} />
                    </div></>}
    {isConfirmed(6) && <><UserBubble text={`Send alerts via ${config.notifications.map(id => NOTIFICATION_OPTIONS.find(option => option.id === id)?.label ?? id).join("; ")}.`} /><div className="flex gap-3 items-start w-full">
                      <BobAvatar small />
                      <ConfirmBubble text="All 7 settings configured. The action is ready to test. Review your configuration and proceed to testing when ready." />
                    </div></>}
    <BobMessages chat={chat} />
  </>;
  const conversationPanel = (drawer = false) => <>
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#e0e0e0] bg-white px-5 py-4">
      <div className="flex min-w-0 items-center gap-3"><BobAvatar /><div><h2 id={drawer ? 'bob-drawer-title' : 'bob-conversation-title'} className="text-[15px] font-semibold text-[#161616]">BOB</h2><p className="text-[12px] text-[#525252]">AI energy assistant · {SNAPSHOT_14_32.timestamp}</p></div></div>
      <BobNewChat chat={chat} />
      {drawer && <button autoFocus aria-label="Close BOB conversation" onClick={() => setAssistantOpen(false)} className="flex size-11 items-center justify-center rounded-[2px] border border-[#e0e0e0] text-xl text-[#525252]">×</button>}
    </div>
    <BobChatScrollArea className="flex-1 px-4 py-6 lg:px-5" updateKey={`${phase}:${confirmed.size}:${chat.messages.length}:${chat.pending}:${chat.error}`} lastUserId={chat.messages.filter(message => message.role === 'user').at(-1)?.id}>
      {conversation}
    </BobChatScrollArea>
    <div className="shrink-0"><BobComposer chat={chat} draft={chatDraft} onDraftChange={setChatDraft} /></div>
  </>;

  return (
    <BoundaryContext.Provider value={rule => { setBoundary(rule); operations.addAudit("Protected request blocked", rule); }}><BobAskContext.Provider value={text => { if (!window.matchMedia('(min-width: 1024px)').matches) setAssistantOpen(true); void chat.send(text); }}>
    <div className="bg-[#f4f4f4] font-sans flex flex-col h-full min-h-0 overflow-hidden w-full [&_button]:min-h-11 [&_button]:min-w-11 [&_button]:focus-visible:outline-2 [&_button]:focus-visible:outline-offset-2 [&_button]:focus-visible:outline-[#0f62fe]">

      {/* Header */}
      <div className="bg-white border-b border-[#e0e0e0] flex min-h-14 flex-wrap gap-3 items-center justify-between py-3 px-6 w-full shrink-0">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="bg-[#0f62fe] flex items-center justify-center rounded-[2px] size-8 shrink-0">
            <img alt="" className="size-5" src={imgBrainCog} />
          </div>
          <p className="font-sans font-semibold text-[#161616] text-[16px]">BOB Agent Setup</p>
          <select aria-label="Selected site" value={SITE.id} onChange={() => {}} className="min-h-11 max-w-full rounded-[2px] border border-[#e0e0e0] bg-white px-3 font-mono text-[13px] text-[#161616] focus:outline-2 focus:outline-[#0f62fe]"><option value={SITE.id}>{SITE.id}</option></select>
          <StatusBadge state={actionState} />
        </div>
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex gap-1.5 items-center">
            <img alt="" className="size-1.5" src={imgEllipse} />
            <p className="font-sans font-medium text-[#525252] text-[13px]">5 connected systems</p>
          </div>
          <p className="font-sans font-medium text-[#525252] text-[13px]">Progress saved on this device</p>
          <button onClick={onClose} className="border border-[#e0e0e0] flex items-center px-3 py-1.5 rounded-[2px] hover:bg-[#f4f4f4] transition-colors cursor-pointer">
            <p className="font-sans font-medium text-[#161616] text-[13px]">Save and exit</p>
          </button>
          <button onClick={onClose} className="border border-[#e0e0e0] flex items-center justify-center rounded-[2px] size-8 shrink-0 hover:bg-[#f4f4f4] transition-colors cursor-pointer">
            <img alt="" className="size-4" src={imgXCircle} />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-white border-b border-[#e0e0e0] flex flex-col gap-2 px-6 py-3 w-full shrink-0">
        <div className="flex w-full gap-3 items-center overflow-x-auto pb-1">
          {[
            { num: 1, label: 'Select action', state: phase === 'welcome' ? 'active' : 'done' },
            { num: 2, label: 'Configure', state: phase === 'welcome' ? 'pending' : 'active' },
            { num: 3, label: 'Test', state: 'pending' },
            { num: 4, label: 'Activate', state: 'pending' },
          ].map((s, i) => (
            <div key={s.num} aria-current={s.state === 'active' ? 'step' : undefined} className="flex shrink-0 gap-3 items-center">
              {i > 0 && <div className="bg-[#e0e0e0] h-px w-10" />}
              <div className="flex gap-2 items-center">
                <div className={`flex items-center justify-center rounded-[2px] size-5 font-mono text-[11px] ${s.state === 'done' ? 'bg-[#0f62fe] text-white font-semibold' : s.state === 'active' ? 'bg-white border-2 border-[#0f62fe] text-[#0f62fe] font-bold' : 'bg-white border border-[#e0e0e0] text-[#8d8d8d]'}`}>
                  {s.num}
                </div>
                <p className={`font-sans font-semibold text-[13px] ${s.state === 'pending' ? 'text-[#8d8d8d]' : 'text-[#0f62fe]'}`}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="font-sans font-medium text-[#525252] text-[13px]">
          <span className="font-mono font-semibold">{configuredCount}</span> of <span className="font-mono">{CONFIG_STEPS.length}</span> configuration decisions completed
        </p>
      </div>

      {/* Workspace */}
      <div className="grid flex-1 min-h-0 min-w-0 w-full lg:grid-cols-[minmax(0,65fr)_minmax(0,35fr)]">

        {/* Chat column */}
        <div className="flex flex-col min-w-0 min-h-0">
          <section aria-label="Configuration cards" className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 md:p-6 lg:p-8"><div className="flex min-w-0 flex-col gap-6">

            {/* Welcome card */}
            {phase === 'welcome' && <WelcomeCard
              onStart={() => setPhase('configuring')}
              started={false}
            />}

            {/* Configuration steps */}
            {phase !== 'welcome' && (
              <>


                {/* Checklist */}
                <ChecklistCard confirmedSet={confirmed} activeStep={activeStep} phase={phase} />

                {/* Step 0: Objective */}
                <StepObjective
                  value={config.objective}
                  onChange={(v) => setConfig(c => ({ ...c, objective: v }))}
                  confirmed={isConfirmed(0)}
                  active={activeStep === 0}
                  onConfirm={() => confirmStep(0)}
                />


                {/* Step 1: Battery */}
                {(isConfirmed(0) || activeStep >= 1) && (
                  <StepBattery
                    value={config.battery}
                    onChange={(v) => setConfig(c => ({ ...c, battery: v }))}
                    confirmed={isConfirmed(1)}
                    active={activeStep === 1}
                    onConfirm={() => confirmStep(1)}
                  />
                )}


                {/* Step 2: Trigger */}
                {isConfirmed(1) && (
                  <StepTrigger
                    value={config.trigger}
                    onChange={(v) => setConfig(c => ({ ...c, trigger: v }))}
                    confirmed={isConfirmed(2)}
                    active={activeStep === 2}
                    onConfirm={() => confirmStep(2)}
                  />
                )}


                {/* Step 3: Safety limits */}
                {isConfirmed(2) && (
                  <StepLimits
                    value={config.limits}
                    onChange={(v) => setConfig(c => ({ ...c, limits: v }))}
                    confirmed={isConfirmed(3)}
                    active={activeStep === 3}
                    onConfirm={() => confirmStep(3)}
                  />
                )}


                {/* Step 4: Automation & approvals */}
                {isConfirmed(3) && (
                  <StepAutomation
                    value={config.automation}
                    onChange={(v) => setConfig(c => ({ ...c, automation: v }))}
                    confirmed={isConfirmed(4)}
                    active={activeStep === 4}
                    onConfirm={() => confirmStep(4)}
                  />
                )}


                {/* Step 5: Recovery */}
                {isConfirmed(4) && (
                  <StepRecovery
                    value={config.recovery}
                    onChange={(v) => setConfig(c => ({ ...c, recovery: v }))}
                    confirmed={isConfirmed(5)}
                    active={activeStep === 5}
                    onConfirm={() => confirmStep(5)}
                  />
                )}


                {/* Step 6: Notifications */}
                {isConfirmed(5) && (
                  <StepNotifications
                    value={config.notifications}
                    onChange={(v) => setConfig(c => ({ ...c, notifications: v }))}
                    confirmed={isConfirmed(6)}
                    active={activeStep === 6}
                    onConfirm={() => confirmStep(6)}
                  />
                )}

                {isConfirmed(6) && (
                  <>
                    <div className="flex gap-3 items-start w-full">
                      <BobAvatar small />
                      <div className="bg-[#e8f1ff] border border-[#0f62fe]/20 flex gap-3 items-center p-4 rounded-[2px] flex-1 min-w-0">
                        <div className="bg-[#0f62fe] flex items-center justify-center rounded-full size-5 shrink-0">
                          <img alt="" className="size-3" src={imgCheck1} />
                        </div>
                        <div className="flex flex-col gap-1 flex-1">
                          <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#0f62fe] text-[14px]" style={{ fontVariationSettings: '"wdth" 100' }}>Configuration complete — 7 of 7 decisions</p>
                          <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#1e3a8a] text-[13px]" style={{ fontVariationSettings: '"wdth" 100' }}>7 required simulations are pending. Proceed to review and testing before activating this action.</p>
                        </div>
                      </div>
                    </div>
                    {policyErrors(config).length > 0 && <p role="alert" className="bg-[#fff1f1] p-4 text-sm text-[#da1e28]">{policyErrors(config).join(" ")}</p>}
                    <div className="flex flex-wrap gap-3">
                      <button disabled={policyErrors(config).length > 0} onClick={() => { if (!policyErrors(config).length) onComplete(config); }} className="bg-[#0f62fe] flex items-center gap-2 px-5 py-2.5 rounded-[2px] hover:bg-[#0043ce] transition-colors cursor-pointer">
                        <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-white text-[14px]" style={{ fontVariationSettings: '"wdth" 100' }}>Review and test</p>
                        <img alt="" className="size-4" src={imgArrowRight} />
                      </button>
                    </div>
                  </>
                )}
              </>
            )}

        {/* Right panel: Configured actions */}
        <div className="bg-white border border-[#e0e0e0] flex flex-col w-full rounded-[2px] overflow-hidden">
          <div className="border-b border-[#e0e0e0] flex flex-wrap gap-3 items-center justify-between px-5 py-4 shrink-0">
            <p className="font-sans font-semibold text-[#161616] text-[15px]">Configured actions · <span className="font-mono">{phase === 'welcome' ? 0 : 1}</span></p>
            <StatusBadge state={actionState} />
          </div>

          {phase === 'welcome' ? <div className="m-5 bg-[#f4f4f4] border border-[#e0e0e0] p-6"><h2 className="mb-3 text-[16px] font-semibold text-[#161616]">No actions configured</h2><p className="mb-5 text-[14px] leading-relaxed text-[#525252]">Choose an action to define what BOB should monitor, recommend, or execute.</p><button onClick={() => setPhase('configuring')} className="bg-[#0f62fe] px-4 py-3 text-[13px] font-semibold text-white hover:bg-[#0043ce] transition-colors rounded-[2px] cursor-pointer">Configure recommended action</button></div> : <div className="flex flex-col gap-5 p-5 overflow-y-auto flex-1">
            <div className="flex flex-col gap-1">
              <p className="font-sans font-semibold text-[#161616] text-[15px] leading-normal">Support demand using {BATTERY_POLICY.name}</p>
              <p className="font-sans font-normal text-[#525252] text-[13px]"><span className="font-mono font-medium">{configuredCount}</span> of <span className="font-mono">{CONFIG_STEPS.length}</span> settings complete</p>
            </div>

            {/* Progress bar */}
            <div className="bg-[#e0e0e0] h-1.5 rounded-full w-full overflow-hidden">
              <div className="bg-[#0f62fe] h-full rounded-full transition-all" style={{ width: `${(configuredCount / CONFIG_STEPS.length) * 100}%` }} />
            </div>

            {/* Step list */}
            <div className="flex flex-col gap-3">
              {CONFIG_STEPS.map((label, i) => {
                const status = itemStatus(i);
                return (
                  <div key={label} className="flex gap-3 items-start">
                    {status === 'done' ? (
                      <div className="bg-[#198038] flex items-center justify-center rounded-[2px] size-[18px] shrink-0 mt-0.5">
                        <img alt="" className="size-3" src={imgCheck1} />
                      </div>
                    ) : status === 'inProgress' ? (
                      <img alt="" className="size-[18px] shrink-0 mt-0.5" src={imgFrame1} />
                    ) : (
                      <div className="border border-[#e0e0e0] rounded-[2px] size-[18px] shrink-0 mt-0.5" />
                    )}
                    <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                      <p className={`font-sans ${status === 'done' ? 'font-medium' : 'font-normal'} text-[13px] ${status === 'missing' ? 'text-[#8d8d8d]' : 'text-[#161616]'}`}>{label}</p>
                      {status === 'done' && i === 0 && <p className="font-sans font-normal text-[#525252] text-[12px]">{PRIORITY_LABELS[config.objective]}</p>}
                      {status === 'done' && i === 1 && <p className="font-sans font-normal text-[#525252] text-[12px]">{BATTERY_POLICY.name}</p>}
                      {status === 'done' && i === 2 && <p className="font-sans font-normal text-[#525252] text-[12px]">Deficit &gt;<span className="font-mono">{config.trigger.deficitMW} MW</span> for <span className="font-mono">{config.trigger.delayMin} min</span></p>}
                      {status === 'done' && i === 3 && <p className="font-sans font-normal text-[#525252] text-[12px]">Max <span className="font-mono">{config.limits.autoMaxMW} MW</span> · Reserve <span className="font-mono">{config.limits.reserveSOC}%</span></p>}
                      {status === 'done' && i === 4 && <p className="font-sans font-normal text-[#525252] text-[12px]">Auto ≤<span className="font-mono">{config.automation.approvalAboveMW} MW</span> · Approval above</p>}
                      {status === 'done' && i === 5 && <p className="font-sans font-normal text-[#525252] text-[12px]">Notify and hold</p>}
                      {status === 'done' && i === 6 && <p className="font-sans font-normal text-[#525252] text-[12px]">{config.notifications.join(" + ")}</p>}
                    </div>
                    {status === 'done' && <button onClick={() => { setPhase('configuring'); setActiveStep(i as ConfigStep); setConfirmed(previous => new Set([...previous].filter(step => step < i))); }} className="text-[12px] text-[#0f62fe] hover:text-[#0043ce] hover:underline cursor-pointer" aria-label={`Edit ${label}`}>Edit</button>}
                  </div>
                );
              })}
            </div>

            {/* Immutable safety info */}
            <div className="bg-[#fef3c7] border border-[#f59e0b]/40 p-4 rounded-[2px]">
              <p className="font-sans font-semibold text-[#78350f] text-[12px] mb-2">Protected limits (cannot be overridden)</p>
              <Link to="/protected" className="inline-flex min-h-11 items-center text-sm text-[#0f62fe] hover:text-[#0043ce] underline">View protected boundary</Link>
              <div className="flex flex-col gap-1.5">
                <p className="font-sans font-normal text-[#78350f] text-[12px] leading-normal">Emergency floor: <span className="font-mono font-semibold">{BATTERY_POLICY.emergencyFloorSOC}% SOC</span> — locked</p>
                <p className="font-sans font-normal text-[#78350f] text-[12px] leading-normal">Equipment maximum: <span className="font-mono font-semibold">{BATTERY_POLICY.equipmentMaxMW} MW</span></p>
                <p className="font-sans font-normal text-[#78350f] text-[12px] leading-normal">Approval required above <span className="font-mono font-semibold">{BATTERY_POLICY.approvalAboveMW} MW</span></p>
              </div>
            </div>
          </div>}
        </div>

          </div></section>


        </div>


        <aside aria-labelledby="bob-conversation-title" className="hidden min-h-0 min-w-0 flex-col border-l border-[#e0e0e0] bg-[#fafafa] lg:flex">{conversationPanel()}</aside>

      </div>
      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[#e0e0e0] bg-white p-3 lg:hidden"><div className="flex min-w-0 items-center gap-3"><BobAvatar small /><span className="text-[13px] font-semibold text-[#161616]">BOB</span></div><button ref={assistantTrigger} aria-haspopup="dialog" aria-controls="bob-chat-drawer" aria-expanded={assistantOpen} onClick={() => setAssistantOpen(true)} className="rounded-[2px] bg-[#0f62fe] px-4 py-3 text-[13px] font-semibold text-white hover:bg-[#0043ce] transition-colors cursor-pointer">Open BOB conversation</button></div>
      <dialog ref={assistantDialog} id="bob-chat-drawer" aria-labelledby="bob-drawer-title" onCancel={() => setAssistantOpen(false)} onClose={() => { setAssistantOpen(false); if (!window.matchMedia('(min-width: 1024px)').matches) assistantTrigger.current?.focus(); }} className="m-0 ml-auto h-dvh max-h-dvh w-full max-w-none border-0 bg-[#fafafa] p-0 text-[#161616] backdrop:bg-black/40 sm:max-w-xl">
        <div className="flex h-full min-h-0 flex-col">{conversationPanel(true)}</div>
      </dialog>
    </div>
    {boundary && <div role="alert" className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-xl border-l-4 border-[#da1e28] bg-white p-5 shadow-lg"><h2 className="font-semibold text-[#da1e28]">Unsafe configuration request blocked</h2><p className="my-3 text-sm">{boundary} Effective policy is unchanged.</p><div className="flex flex-wrap gap-4 text-sm"><Link to="/protected" className="text-[#0f62fe] underline">Inspect rule</Link><button onClick={() => { setBoundary(''); setPhase('configuring'); setActiveStep(3); setConfirmed(previous => new Set([...previous].filter(step => step < 3))); }}>Choose safe limits</button><button onClick={() => setBoundary('')}>Cancel</button></div></div>}
    </BobAskContext.Provider></BoundaryContext.Provider>
  );
}

// ─── Sub-cards ────────────────────────────────────────────────────────────────

function ConfirmBubble({ text }: { text: string }) {
  return (
    <div className="bg-white border border-[#e0e0e0] flex gap-3 items-center p-4 rounded-[2px] max-w-[70%] min-w-0 font-sans">
      <div className="bg-[#198038] flex items-center justify-center rounded-[2px] size-[18px] shrink-0">
        <img alt="" className="size-3" src={imgCheck} />
      </div>
      <p className="font-sans font-semibold text-[#161616] text-[14px] leading-normal flex-1">{text}</p>
    </div>
  );
}

function WelcomeCard({ onStart, started }: { onStart: () => void; started: boolean }) {
  const ask = useContext(BobAskContext);
  const imgBattery2 = `${assetPathPrefix}/2951d.svg`;
  const imgZap2 = `${assetPathPrefix}/eee89.svg`;
  const imgPlug2 = `${assetPathPrefix}/8b4e5.svg`;
  const imgToolbox2 = `${assetPathPrefix}/e087a.svg`;
  const cards = [
    { icon: imgBattery2, title: 'Discharge battery to support demand', recommended: true },
    { icon: imgZap2, title: 'Charge battery using surplus solar', recommended: false },
    { icon: imgPlug2, title: 'Import energy when supply is low', recommended: false },
    { icon: imgToolbox2, title: 'Create maintenance work order', recommended: false },
  ];
  return (
    <div className="bg-white border border-[#e0e0e0] flex flex-col gap-5 p-5 rounded-[2px] w-full font-sans">
      <div className="flex flex-wrap gap-3 items-center">
        <BobAvatar />
        <div>
          <p className="font-sans font-semibold text-[#161616] text-[14px]">BOB</p>
          <p className="font-sans font-normal text-[#8d8d8d] text-[12px]">AI energy assistant · <span className="font-mono">{SNAPSHOT_14_32.timestamp}</span></p>
        </div>
      </div>
      <p className="font-sans font-normal text-[#161616] text-[15px] leading-relaxed">
        Let's configure what I can do for {SITE.name}. Solar is generating <span className="font-mono font-semibold">{SNAPSHOT_14_32.solar} MW</span> against a <span className="font-mono font-semibold">{SNAPSHOT_14_32.demand} MW</span> demand — I recommend starting with battery discharge.
      </p>
      <div className="border border-[#e0e0e0] bg-[#f4f4f4] p-4 rounded-[2px]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-[14px] font-semibold text-[#161616]">Prerequisites</h2><span className="bg-[#edf5ff] border border-[#a6c8ff]/60 px-2 py-1 text-[11px] font-mono text-[#0043ce]">Preview snapshot · Verified</span></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[
            ['Site', `${SITE.name} Site`, `${SITE.id} · ${SITE.capacity} MW`],
            ['Connected systems', '3 connected', 'SCADA, battery, and grid gateway'],
            ['Monitoring feeds', '6 available', 'Solar, demand, battery, grid, weather, inverter'],
            ['Battery 1 remote control', 'Granted and verified', 'Battery 1 is verified; other assets require separate control verification'],
            ['BOB permission', 'Granted and verified', 'Activation requires all 7 simulations to pass'],
          ].map(([label, value, detail]) => <div key={label} className="border border-[#e0e0e0] bg-white p-3 rounded-[2px]"><p className="mb-1 text-[11px] text-[#8d8d8d]">{label}</p><p className="mb-1 text-[13px] font-semibold text-[#161616]">{value}</p><p className="text-[12px] leading-relaxed text-[#525252]">{detail}</p></div>)}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {cards.map(card => (
          <button key={card.title} onClick={!started && card.recommended ? onStart : () => ask(`Explain the prerequisites and setup for: ${card.title}`)}
            className={`flex flex-col gap-3 p-4 rounded-[2px] border text-left transition-all cursor-pointer ${card.recommended ? 'border-[#0f62fe] bg-[#edf5ff]/40 hover:shadow-sm' : 'border-[#e0e0e0] bg-white hover:border-[#0f62fe]'}`}>
            <div className="bg-[#f4f4f4] flex items-center justify-center rounded-[2px] size-8 border border-[#e0e0e0]">
              <img alt="" className="size-[18px]" src={card.icon} />
            </div>
            <div className="flex items-start justify-between gap-2">
              <p className="font-sans font-semibold text-[#161616] text-[13px] leading-normal flex-1">{card.title}</p>
              {card.recommended && (
                <div className="bg-[#defbe6] border border-[#198038]/40 px-1.5 py-0.5 rounded-[2px] shrink-0">
                  <p className="font-sans font-semibold text-[#198038] text-[10px]">Recommended</p>
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        <button onClick={onStart} disabled={started} className="bg-[#0f62fe] flex items-center px-4 py-2.5 rounded-[2px] hover:bg-[#0043ce] transition-colors cursor-pointer disabled:opacity-60 text-white">
          <p className="font-sans font-semibold text-white text-[13px]">Configure battery discharge</p>
        </button>
        <button onClick={() => ask("Explain the available actions and their prerequisites for this site.")} className="border border-[#e0e0e0] bg-white flex items-center px-4 py-2.5 rounded-[2px] hover:bg-[#f4f4f4] transition-colors cursor-pointer">
          <p className="font-sans font-medium text-[#161616] text-[13px]">View all actions</p>
        </button>
      </div>
    </div>
  );
}

function ChecklistCard({ confirmedSet, activeStep, phase }: { confirmedSet: Set<ConfigStep>; activeStep: ConfigStep; phase: ChatPhase }) {
  return (
    <div className="flex gap-3 items-start w-full font-sans">
      <BobAvatar small />
      <div className="flex flex-col gap-3 flex-1">
        <p className="font-sans font-normal text-[#161616] text-[14px] leading-normal">
          I'll guide you through <span className="font-mono font-semibold">{CONFIG_STEPS.length}</span> configuration decisions for this action.
        </p>
        <div className="bg-white border border-[#e0e0e0] flex flex-col gap-2.5 p-4 rounded-[2px]">
          {CONFIG_STEPS.map((label, i) => {
            const done = confirmedSet.has(i as ConfigStep);
            const inProg = phase !== 'welcome' && i === activeStep && !done;
            return (
              <div key={label} className="flex flex-wrap gap-3 items-center">
                {done ? (
                  <div className="bg-[#198038] flex items-center justify-center rounded-[2px] size-[18px] shrink-0">
                    <img alt="" className="size-3" src={imgCheck} />
                  </div>
                ) : inProg ? (
                  <img alt="" className="size-[18px] shrink-0" src={imgFrame1} />
                ) : (
                  <div className="border border-[#e0e0e0] rounded-[2px] size-[18px] shrink-0" />
                )}
                <p className={`font-sans ${done ? 'font-medium' : 'font-normal'} text-[13px] ${!done && !inProg ? 'text-[#8d8d8d]' : 'text-[#161616]'}`}>{label}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function RadioCard({ id, label, recommended, selected, disabled, onChange }: { id: string; label: string; recommended?: boolean; selected: boolean; disabled?: boolean; onChange: () => void }) {
  return (
    <button role="radio" aria-checked={selected} disabled={disabled} onKeyDown={event => { if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return; const group = event.currentTarget.closest('[role="radiogroup"]'); const options = [...(group?.querySelectorAll<HTMLButtonElement>('[role="radio"]:not(:disabled)') ?? [])]; if (!options.length) return; event.preventDefault(); const position = options.indexOf(event.currentTarget); const next = options[(position + (event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 1) + options.length) % options.length]; next.focus(); next.click(); }} onClick={!disabled ? onChange : undefined}
      className={`flex gap-3 items-center p-3.5 rounded-[2px] border w-full text-left transition-all ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${selected ? 'border-[#0f62fe] bg-[#edf5ff]' : 'border-[#e0e0e0] bg-white hover:border-[#0f62fe]'}`}>
      <div className={`flex items-center justify-center rounded-full size-[18px] border-2 shrink-0 ${selected ? 'border-[#0f62fe] bg-[#0f62fe]' : 'border-[#8d8d8d] bg-white'}`}>
        {selected && <div className="size-2 bg-white rounded-full" />}
      </div>
      <p className="font-sans font-medium text-[#161616] text-[13px] flex-1">{label}</p>
      {recommended && (
        <div className="bg-[#defbe6] border border-[#198038]/40 px-1.5 py-0.5 rounded-[2px]">
          <p className="font-sans font-semibold text-[#198038] text-[10px]">Recommended</p>
        </div>
      )}
    </button>
  );
}

function StepCard({ title, hint, confirmed, onConfirm, onUseRec, children }: { title: string; hint?: string; confirmed: boolean; onConfirm: () => void; onUseRec?: () => void; children: React.ReactNode }) {
  const ask = useContext(BobAskContext);
  if (confirmed) return null;
  return (
    <div className="flex gap-3 items-start w-full min-w-0 font-sans">
      <BobAvatar small />
      <div className="bg-white border border-[#e0e0e0] flex flex-col gap-4 p-5 rounded-[2px] flex-1 min-w-0">
        <p className="font-sans font-semibold text-[#161616] text-[14px]">{title}</p>
        {children}
        {hint && <p className="font-sans font-normal text-[#525252] text-[13px] leading-relaxed">{hint}</p>}
        {!confirmed && (
          <div className="flex flex-wrap gap-3">
            <button onClick={onUseRec || onConfirm} className="bg-[#0f62fe] flex items-center px-4 py-2.5 rounded-[2px] hover:bg-[#0043ce] transition-colors cursor-pointer text-white">
              <p className="font-sans font-semibold text-white text-[13px]">Use recommendation</p>
            </button>
            <button onClick={() => ask(`Explain the recommendation and safety implications for: ${title}`)} className="border border-[#e0e0e0] bg-white flex items-center px-4 py-2.5 rounded-[2px] hover:bg-[#f4f4f4] transition-colors cursor-pointer">
              <p className="font-sans font-medium text-[#161616] text-[13px]">Explain recommendation</p>
            </button>
          </div>
        )}
        {confirmed && (
          <div className="flex gap-2 items-center">
            <div className="bg-[#198038] flex items-center justify-center rounded-[2px] size-[18px] shrink-0">
              <img alt="" className="size-3" src={imgCheck} />
            </div>
            <p className="font-sans font-medium text-[#161616] text-[13px]">Confirmed</p>
          </div>
        )}
      </div>
    </div>
  );
}

function StepObjective({ value, onChange, confirmed, active, onConfirm }: { value: string; onChange: (v: string) => void; confirmed: boolean; active: boolean; onConfirm: () => void }) {
  return (
    <StepCard title="What should this action prioritize?" hint="Recommended because this site is currently operating in Reliability mode." confirmed={confirmed} onConfirm={onConfirm}>
      <div role="radiogroup" aria-label="Objective selection" className="flex flex-col gap-2">
        {PRIORITIES.map(p => (
          <RadioCard key={p.id} id={p.id} label={p.label} recommended={p.recommended} selected={value === p.id} disabled={confirmed} onChange={() => onChange(p.id)} />
        ))}
      </div>
    </StepCard>
  );
}

function StepBattery({ value, onChange, confirmed, active, onConfirm }: { value: string; onChange: (v: string) => void; confirmed: boolean; active: boolean; onConfirm: () => void }) {
  const { state, flow } = useOperations();
  const reserve = state.config.limits.reserveSOC;
  return (
    <StepCard title="Which battery should I use for this action?" confirmed={confirmed} onConfirm={onConfirm}
      hint="Battery 1 is recommended — available, sufficient charge, no maintenance restrictions.">
      <div className="flex flex-col gap-3 font-sans">
        {/* Battery 1 */}
        <button onClick={!confirmed ? () => onChange('battery1') : undefined}
          className={`flex flex-col gap-3 p-4 rounded-[2px] border w-full text-left transition-all cursor-pointer ${value === 'battery1' ? 'border-[#0f62fe] bg-[#edf5ff]' : 'border-[#e0e0e0] bg-white hover:border-[#0f62fe]'}`}>
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-[#0f62fe] h-12 w-1 rounded-none" />
              <p className="font-sans font-semibold text-[#161616] text-[14px]">Battery 1</p>
            </div>
            <div className="bg-[#defbe6] border border-[#198038]/40 px-2 py-0.5 rounded-[2px]">
              <p className="font-sans font-semibold text-[#198038] text-[11px]">Recommended</p>
            </div>
          </div>
          <div className="flex gap-4 flex-wrap text-sm">
            <div className="bg-[#defbe6] border border-[#198038]/40 px-2 py-0.5 rounded-[2px]"><p className="font-sans font-semibold text-[#198038] text-[11px]">Available</p></div>
            <p className="font-sans font-normal text-[#525252] text-[13px]">SOC: <span className="font-mono font-medium text-[#161616]">{flow.soc}%</span></p>
            <p className="font-sans font-normal text-[#525252] text-[13px]">Max: <span className="font-mono font-medium text-[#161616]">{BATTERY_POLICY.equipmentMaxMW} MW</span></p>
            <p className="font-sans font-normal text-[#525252] text-[13px]">Usable: <span className="font-mono font-medium text-[#161616]">{Math.max(0, (flow.soc - reserve) * 0.2).toFixed(1)} MWh</span></p>
            <p className="font-sans font-normal text-[#525252] text-[13px]">Health: <span className="font-mono font-medium text-[#161616]">{BATTERY_POLICY.health}</span></p>
          </div>
        </button>
        {/* Battery 2 */}
        <div className="flex flex-col gap-3 p-4 rounded-[2px] border border-[#e0e0e0] bg-[#f4f4f4] opacity-60">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <p className="font-sans font-semibold text-[#161616] text-[14px]">Battery 2</p>
            <div className="bg-[#fff1f1] border border-[#da1e28]/40 px-2 py-0.5 rounded-[2px]">
              <p className="font-sans font-semibold text-[#da1e28] text-[11px]">Not connected</p>
            </div>
          </div>
          <p className="font-sans font-normal text-[#8d8d8d] text-[13px]">Secondary battery is not connected to KUP-SOLAR-001; no SOC or control permission is available.</p>
        </div>
      </div>
    </StepCard>
  );
}

function NumInput({ label, value, min, max, step, unit, onChange, disabled }: { label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void; disabled?: boolean }) {
  const boundary = useContext(BoundaryContext);
  return (
    <div className="flex flex-wrap gap-3 items-center justify-between gap-4 font-sans">
      <p className="font-sans font-normal text-[#161616] text-[13px] flex-1">{label}</p>
      <div className="flex items-center gap-2">
        <button aria-label={`Decrease ${label}`} disabled={disabled} onClick={() => { if (value - step < min) boundary(`${label} cannot be below ${min} ${unit}.`); else onChange(value - step); }} className={`border border-[#e0e0e0] bg-white flex items-center justify-center rounded-[2px] size-7 text-[#161616] text-[16px] ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#f4f4f4] cursor-pointer'}`}>−</button>
        <span className="font-mono font-semibold text-[#161616] text-[14px] w-20 text-center">{value} {unit}</span>
        <button aria-label={`Increase ${label}`} disabled={disabled} onClick={() => { if (value + step > max) boundary(`${label} cannot exceed ${max} ${unit}.`); else onChange(value + step); }} className={`border border-[#e0e0e0] bg-white flex items-center justify-center rounded-[2px] size-7 text-[#161616] text-[16px] ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#f4f4f4] cursor-pointer'}`}>+</button>
      </div>
    </div>
  );
}

function StepTrigger({ value, onChange, confirmed, active, onConfirm }: { value: ActionConfig['trigger']; onChange: (v: ActionConfig['trigger']) => void; confirmed: boolean; active: boolean; onConfirm: () => void }) {
  return (
    <StepCard title="When should this action start?" hint="Recommended: start when demand exceeds solar by more than 3 MW, sustained for 5 minutes. This avoids reacting to brief transients." confirmed={confirmed} onConfirm={onConfirm}>
      <div className="flex flex-col gap-3 bg-[#f4f4f4] border border-[#e0e0e0] p-4 rounded-[2px]">
        <NumInput label="Start when deficit exceeds" value={value.deficitMW} min={BATTERY_POLICY.startThresholdMW} max={10} step={1} unit="MW" disabled={confirmed} onChange={(v) => onChange({ ...value, deficitMW: v })} />
        <div className="bg-[#e0e0e0] h-px w-full" />
        <NumInput label="Sustained for at least" value={value.delayMin} min={BATTERY_POLICY.startDelay} max={15} step={1} unit="min" disabled={confirmed} onChange={(v) => onChange({ ...value, delayMin: v })} />
      </div>
      <div className="bg-[#edf5ff] border border-[#a6c8ff]/60 p-3 rounded-[2px]">
        <p className="font-sans font-normal text-[#0043ce] text-[12px] leading-relaxed">At <span className="font-mono">{SNAPSHOT_14_32.timestamp}</span>: Solar <span className="font-mono">{SNAPSHOT_14_32.solar} MW</span>, Demand <span className="font-mono">{SNAPSHOT_14_32.demand} MW</span>. The pre-battery shortfall is <span className="font-mono">{SNAPSHOT_14_32.demand - SNAPSHOT_14_32.solar} MW</span>. Starting also requires the configured persistence window, SOC above <span className="font-mono">{BATTERY_POLICY.startSOC}%</span>, and verified fresh telemetry.</p>
      </div>
    </StepCard>
  );
}

function StepLimits({ value, onChange, confirmed, active, onConfirm }: { value: ActionConfig['limits']; onChange: (v: ActionConfig['limits']) => void; confirmed: boolean; active: boolean; onConfirm: () => void }) {
  return (
    <StepCard title="What are the discharge limits?" confirmed={confirmed} onConfirm={onConfirm}
      hint={`Equipment maximum is ${BATTERY_POLICY.equipmentMaxMW} MW. Emergency floor at ${BATTERY_POLICY.emergencyFloorSOC}% SOC is locked and cannot be overridden.`}>
      <div className="flex flex-col gap-3 bg-[#f4f4f4] border border-[#e0e0e0] p-4 rounded-[2px]">
        <NumInput label="Maximum automatic discharge" value={value.autoMaxMW} min={1} max={BATTERY_POLICY.autoMaxMW} step={1} unit="MW" disabled={confirmed} onChange={(v) => onChange({ ...value, autoMaxMW: v })} />
        <div className="bg-[#e0e0e0] h-px w-full" />
        <NumInput label="Stop at reserve SOC" value={value.reserveSOC} min={BATTERY_POLICY.reserveSOC} max={70} step={5} unit="%" disabled={confirmed} onChange={(v) => onChange({ ...value, reserveSOC: v })} />
        <div className="bg-[#e0e0e0] h-px w-full" />
        <NumInput label="Maximum duration" value={value.maxDuration} min={5} max={BATTERY_POLICY.maxDuration} step={5} unit="min" disabled={confirmed} onChange={(v) => onChange({ ...value, maxDuration: v })} />
        <div className="bg-[#e0e0e0] h-px w-full" />
        <NumInput label="Maximum energy per action" value={value.maxEnergyMWh} min={0.5} max={BATTERY_POLICY.maxEnergyMWh} step={0.5} unit="MWh" disabled={confirmed} onChange={(v) => onChange({ ...value, maxEnergyMWh: v })} />
      </div>
      <div className="border border-[#e0e0e0] p-4 rounded-[2px] bg-white">
        <h3 className="mb-3 text-[13px] font-semibold text-[#161616]">Protected limits · Always enforced</h3>
        <div className="flex flex-col gap-2">
          {[`Locked emergency floor: ${BATTERY_POLICY.emergencyFloorSOC}% SOC`, `Administrator approval above ${BATTERY_POLICY.autoMaxMW} MW; equipment maximum ${BATTERY_POLICY.equipmentMaxMW} MW`, 'Stop at the configured reserve; never bypass it', 'Block execution when telemetry is unsafe, unavailable, or stale', 'Do not start while maintenance is active', 'Stop when the deficit clears or the duration / energy cap is reached'].map(rule => <div key={rule} className="flex items-start gap-3 border border-[#e0e0e0] bg-[#f4f4f4] p-3 rounded-[2px]"><span aria-hidden="true" className="text-[#198038] font-bold">✓</span><p className="text-[13px] leading-relaxed text-[#161616]">{rule}</p></div>)}
        </div>
      </div>
      <div className="bg-[#fef3c7] border border-[#f59e0b]/40 p-3 rounded-[2px]">
        <p className="font-sans font-semibold text-[#78350f] text-[12px] mb-1">Protected: Emergency floor</p>
        <p className="font-sans font-normal text-[#78350f] text-[12px]">Discharge stops at the configured <span className="font-mono">{value.reserveSOC}%</span> reserve. The <span className="font-mono">{BATTERY_POLICY.emergencyFloorSOC}%</span> emergency floor is an additional locked boundary, not an operating target.</p>
      </div>
    </StepCard>
  );
}

function StepAutomation({ value, onChange, confirmed, active, onConfirm }: { value: ActionConfig['automation']; onChange: (v: ActionConfig['automation']) => void; confirmed: boolean; active: boolean; onConfirm: () => void }) {
  return (
    <StepCard title="Automation and approvals" hint="Requests above the automatic limit require administrator approval before execution. Approval expires to prevent stale authorizations." confirmed={confirmed} onConfirm={onConfirm}>
      <div className="flex flex-col gap-3 bg-[#f4f4f4] border border-[#e0e0e0] p-4 rounded-[2px]">
        <NumInput label="Auto-start without approval up to (locked policy)" value={value.approvalAboveMW} min={6} max={6} step={1} unit="MW" disabled={confirmed} onChange={() => {}} />
        <div className="bg-[#e0e0e0] h-px w-full" />
        <NumInput label="Approval expires after (locked policy)" value={value.approvalExpiryMin} min={10} max={10} step={1} unit="min" disabled={confirmed} onChange={() => {}} />
      </div>
    </StepCard>
  );
}

function StepRecovery({ value, onChange, confirmed, active, onConfirm }: { value: string; onChange: (v: string) => void; confirmed: boolean; active: boolean; onConfirm: () => void }) {
  return (
    <StepCard title="What should I do if Battery 1 becomes unavailable during discharge?" hint="This applies if the battery trips, enters a fault state, or telemetry is lost for more than 2 minutes." confirmed={confirmed} onConfirm={onConfirm}>
      <div role="radiogroup" aria-label="Recovery behavior" className="flex flex-col gap-2">
        {RECOVERY_OPTIONS.map(opt => (
          <RadioCard key={opt.id} id={opt.id} label={opt.label} recommended={opt.recommended} selected={value === opt.id} disabled={confirmed} onChange={() => onChange(opt.id)} />
        ))}
      </div>
    </StepCard>
  );
}

const NOTIFICATION_OPTIONS = [
  { id: 'sms', label: 'SMS — Operations team' },
  { id: 'email', label: 'Email — Site managers' },
  { id: 'push', label: 'Push — Plug.ai mobile app' },
  { id: 'slack', label: 'Slack — #kuppam-ops channel' },
];

function StepNotifications({ value, onChange, confirmed, active, onConfirm }: { value: string[]; onChange: (v: string[]) => void; confirmed: boolean; active: boolean; onConfirm: () => void }) {
  const toggle = (id: string) => {
    if (confirmed) return;
    if (value.includes(id)) onChange(value.filter(v => v !== id));
    else onChange([...value, id]);
  };
  return (
    <StepCard title="Who should be notified when this action runs?" hint="Notifications fire at action start, completion, approval request, and failure." confirmed={confirmed} onConfirm={onConfirm}>
      <div className="flex flex-col gap-2">
        {NOTIFICATION_OPTIONS.map(opt => (
          <button key={opt.id} onClick={() => toggle(opt.id)}
            className={`flex gap-3 items-center p-3.5 rounded-[2px] border w-full text-left transition-all cursor-pointer ${value.includes(opt.id) ? 'border-[#0f62fe] bg-[#edf5ff]' : 'border-[#e0e0e0] bg-white hover:border-[#0f62fe]'}`}>
            <div className={`flex items-center justify-center rounded-[2px] size-[18px] border-2 shrink-0 ${value.includes(opt.id) ? 'border-[#0f62fe] bg-[#0f62fe]' : 'border-[#8d8d8d] bg-white'}`}>
              {value.includes(opt.id) && <img alt="" className="size-3" src={imgCheck} />}
            </div>
            <p className="font-sans font-medium text-[#161616] text-[13px]">{opt.label}</p>
          </button>
        ))}
      </div>
    </StepCard>
  );
}
