import { useState, useEffect, useRef, createContext, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router';
import { configApi, siteApi, type ConfigOptions, type ConfigValues, type Preferences } from './api/client';
import { useBobChat, BobMessages, BobComposer, BobChatScrollArea, BobNewChat } from './BobChat';
import { SITE } from './data';
import { AUTONOMY, NOTIFY, OBJECTIVES, RECOVERY, configKindLabel, limitsSummary, mwh, watchLabel } from './format';
import { useSite } from './site';

const BobAskContext = createContext<(text: string) => void>(() => {});
const BoundaryContext = createContext<(rule: string) => void>(() => {});

const assetPathPrefix = '/assets';
const imgBrainCog = `${assetPathPrefix}/71557.svg`;
const imgEllipse = `${assetPathPrefix}/2ea7c.svg`;
const imgXCircle = `${assetPathPrefix}/179e0.svg`;
const imgCheck = `${assetPathPrefix}/a0519.svg`;
const imgArrowRight = `${assetPathPrefix}/21c0f.svg`;
const imgCheck1 = `${assetPathPrefix}/f6f5a.svg`;
const imgFrame1 = `${assetPathPrefix}/10ff0.svg`;
const imgBot = `${assetPathPrefix}/0d037.svg`;

const STEPS = ['Objective', 'Asset and action', 'Trigger conditions', 'Safety limits', 'Automation & approvals', 'Recovery behavior', 'Notifications'];

const option = <K extends string>(labels: Record<K, string>, recommended?: K) =>
  (Object.entries(labels) as Array<[K, string]>).map(([id, label]) => ({ id, label, recommended: id === recommended }));
const PRIORITIES = option(OBJECTIVES, 'reliability');
const RECOVERY_OPTIONS = option(RECOVERY, 'notify_and_hold');
const NOTIFICATION_OPTIONS = option(NOTIFY);

type Bounds = { rating: number; ceiling: number; floor: number; energy: number };
const LIMIT_INPUTS: Record<string, { label: string; unit: string; step: number; min: (b: Bounds) => number; max: (b: Bounds) => number }> = {
  auto_max_mw: { label: 'Automatic up to', unit: 'MW', step: 1, min: () => 0, max: (b) => b.ceiling },
  max_mw: { label: 'Never more than', unit: 'MW', step: 1, min: () => 1, max: (b) => b.rating },
  reserve_pct: { label: 'Stop at reserve SOC', unit: '%', step: 5, min: (b) => b.floor, max: () => 80 },
  max_minutes: { label: 'Maximum continuous discharge', unit: 'min', step: 15, min: () => 15, max: () => 240 },
  max_mwh: { label: 'Maximum energy in that time', unit: 'MWh', step: 0.5, min: () => 0.5, max: (b) => b.energy },
  min_price_inr_mwh: { label: 'Sell only above', unit: '₹/MWh', step: 500, min: () => 0, max: () => 20000 },
};

type ConfigStep = 0 | 1 | 2 | 3 | 4 | 5 | 6;
type ChatPhase = 'welcome' | 'configuring' | 'done';
type Limits = Record<string, number>;

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

function StepCard({ title, hint, confirmed, onConfirm, children }: { title: string; hint?: string; confirmed: boolean; onConfirm: () => void; children: React.ReactNode }) {
  const ask = useContext(BobAskContext);
  if (confirmed) return null;
  return (
    <div className="flex gap-3 items-start w-full min-w-0 font-sans">
      <BobAvatar small />
      <div className="bg-white border border-[#e0e0e0] flex flex-col gap-4 p-5 rounded-[2px] flex-1 min-w-0">
        <p className="font-sans font-semibold text-[#161616] text-[14px]">{title}</p>
        {children}
        {hint && <p className="font-sans font-normal text-[#525252] text-[13px] leading-relaxed">{hint}</p>}
        <div className="flex flex-wrap gap-3">
          <button onClick={onConfirm} className="bg-[#0f62fe] flex items-center px-4 py-2.5 rounded-[2px] hover:bg-[#0043ce] transition-colors cursor-pointer text-white">
            <p className="font-sans font-semibold text-white text-[13px]">Confirm</p>
          </button>
          <button onClick={() => ask(`Explain the recommendation and safety implications for: ${title}`)} className="border border-[#e0e0e0] bg-white flex items-center px-4 py-2.5 rounded-[2px] hover:bg-[#f4f4f4] transition-colors cursor-pointer">
            <p className="font-sans font-medium text-[#161616] text-[13px]">Explain recommendation</p>
          </button>
        </div>
      </div>
    </div>
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


export default function AgentChat({ onClose, onComplete }: { onClose: () => void; onComplete: (configId: number) => void }) {
  const site = useSite();
  const options = useQuery({ queryKey: ['config-options', SITE.id], queryFn: () => configApi.options(SITE.id) }).data;
  const choices = options?.assets.flatMap((asset) => asset.actions.map((kind) => ({ asset, kind }))) ?? [];
  const [boundary, setBoundary] = useState('');
  const [phase, setPhase] = useState<ChatPhase>('welcome');
  const [activeStep, setActiveStep] = useState<ConfigStep>(0);
  const [confirmed, setConfirmed] = useState<Set<ConfigStep>>(new Set());
  const [choice, setChoice] = useState<{ asset: string; kind: string } | null>(null);
  const [values, setValues] = useState<ConfigValues | null>(null);
  const [saving, setSaving] = useState(false);
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

  const current = (code: string, kind: string) => site.configs.find((c) => c.asset === code && c.kind === kind);
  // Start from the action's current configuration; limits it does not set start at a suggestion, shown and saved alike.
  const pick = (code: string, kind: string) => {
    const rating = options?.assets.find((a) => a.code === code)?.capacity_mw ?? 0;
    const allowed = options?.limits[kind] ?? [];
    const suggested: Limits = {
      max_mw: rating, auto_max_mw: Math.min(rating, options?.protected.approval_above_mw ?? rating),
      reserve_pct: Math.max(55, options?.protected.battery_soc_floor_pct ?? 0), max_minutes: 30, max_mwh: 3, min_price_inr_mwh: 0,
    };
    const found = current(code, kind);
    setChoice({ asset: code, kind });
    setValues({
      name: found?.name ?? `${configKindLabel(kind)}: ${options?.assets.find((a) => a.code === code)?.name ?? code}`,
      autonomy: found?.autonomy ?? 'auto',
      limits: { ...Object.fromEntries(allowed.filter((k) => k in suggested).map((k) => [k, suggested[k]])), ...found?.limits },
      approval: { response_min: 10, ...found?.approval },
      watch: found?.watch ?? [],
      preferences: found?.preferences ?? { objective: 'reliability', recovery: 'notify_and_hold', notify: ['sms', 'email'] },
    });
  };
  const start = (code: string, kind: string) => { pick(code, kind); setPhase('configuring'); };
  // Opened for one action (from the action library's Edit), start on it directly.
  const wanted = new URLSearchParams(useLocation().search);
  useEffect(() => {
    const code = wanted.get('asset'), kind = wanted.get('kind');
    if (options && code && kind && !choice && options.assets.some((a) => a.code === code && a.actions.includes(kind))) start(code, kind);
  }, [options]);
  const asset = options?.assets.find((a) => a.code === choice?.asset);
  const kind = choice?.kind ?? '';
  const reading = site.live?.batteries.find((b) => b.code === choice?.asset);
  const setLimits = (limits: Limits) => setValues((v) => v && { ...v, limits });
  const setPreferences = (p: Partial<Preferences>) => setValues((v) => v && { ...v, preferences: { ...v.preferences, ...p } });

  const confirmStep = (step: ConfigStep) => {
    setConfirmed(prev => new Set(prev).add(step));
    if (step < 6) setActiveStep((step + 1) as ConfigStep);
    else setPhase('done');
  };
  const editFrom = (step: number) => { setPhase('configuring'); setActiveStep(step as ConfigStep); setConfirmed(previous => new Set([...previous].filter(s => s < step))); };
  const isConfirmed = (s: ConfigStep) => confirmed.has(s);
  const save = async () => {
    if (!values || !choice) return;
    setSaving(true);
    try {
      const saved = await configApi.save(SITE.id, { ...values, ...choice });
      onComplete(saved.id);
    } catch (failure) {
      setBoundary(failure instanceof Error ? failure.message : 'The configuration was not saved.');
    } finally {
      setSaving(false);
    }
  };

  const status = phase === 'done' ? 'Ready to review' : phase === 'welcome' ? 'Draft' : 'Configuring';
  const itemStatus = (i: number): 'done' | 'inProgress' | 'missing' =>
    confirmed.has(i as ConfigStep) ? 'done' : i === activeStep && phase === 'configuring' ? 'inProgress' : 'missing';
  const limits = values?.limits ?? {};
  const watchable = options?.assets.filter((a) => a.watch_metric) ?? [];
  const names = Object.fromEntries(watchable.map((a) => [a.code, a.name]));
  const watch = values?.watch[0];
  const watched = watch && watchable.find((a) => a.code === (watch.asset ?? asset?.code));
  const summary = (i: number) => !values ? '' : [
    OBJECTIVES[values.preferences.objective],
    `${configKindLabel(kind)} · ${asset?.name ?? ''}`,
    [limits.deficit_mw === undefined ? 'Whenever BOB’s plan calls for it' : `Portfolio short by >${limits.deficit_mw} MW${limits.deficit_minutes ? ` for ${limits.deficit_minutes} min` : ''}`,
      ...values.watch.map((w) => `re-plan when ${watchLabel(w, asset?.name ?? '', names)}`)].join('; '),
    limitsSummary(limits).slice(0, 2).join(' · '),
    `${AUTONOMY[values.autonomy].label} · answer within ${values.approval.response_min ?? 10} min`,
    RECOVERY[values.preferences.recovery],
    values.preferences.notify.join(' + ') || 'Nobody',
  ][i];

  const conversation = <>
    {phase !== 'welcome' && <UserBubble text={`Configure ${configKindLabel(kind).toLowerCase()} on ${asset?.name ?? ''}.`} />}
    {values && STEPS.map((step, i) => isConfirmed(i as ConfigStep) && (
      <div key={step} className="flex flex-col gap-3">
        <UserBubble text={`${step}: ${summary(i)}.`} />
        <div className="flex gap-3 items-start w-full"><BobAvatar small /><ConfirmBubble text={i === 6 ? 'All 7 settings configured. Review the configuration, then save it as a draft to test.' : `Configured: ${summary(i)}.`} /></div>
      </div>
    ))}
    <BobMessages chat={chat} />
  </>;
  const conversationPanel = (drawer = false) => <>
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#e0e0e0] bg-white px-5 py-4">
      <div className="flex min-w-0 items-center gap-3"><BobAvatar /><div><h2 id={drawer ? 'bob-drawer-title' : 'bob-conversation-title'} className="text-[15px] font-semibold text-[#161616]">BOB</h2><p className="text-[12px] text-[#525252]">AI energy assistant</p></div></div>
      <BobNewChat chat={chat} />
      {drawer && <button autoFocus aria-label="Close BOB conversation" onClick={() => setAssistantOpen(false)} className="flex size-11 items-center justify-center rounded-[2px] border border-[#e0e0e0] text-xl text-[#525252]">×</button>}
    </div>
    <BobChatScrollArea className="flex-1 px-4 py-6 lg:px-5" updateKey={`${phase}:${confirmed.size}:${chat.messages.length}:${chat.pending}:${chat.error}`} lastUserId={chat.messages.filter(message => message.role === 'user').at(-1)?.id}>
      {conversation}
    </BobChatScrollArea>
    <div className="shrink-0"><BobComposer chat={chat} draft={chatDraft} onDraftChange={setChatDraft} /></div>
  </>;

  return (
    <BoundaryContext.Provider value={setBoundary}><BobAskContext.Provider value={text => { if (!window.matchMedia('(min-width: 1024px)').matches) setAssistantOpen(true); void chat.send(text); }}>
    <div className="bg-[#f4f4f4] font-sans flex flex-col h-full min-h-0 overflow-hidden w-full [&_button]:min-h-11 [&_button]:min-w-11 [&_button]:focus-visible:outline-2 [&_button]:focus-visible:outline-offset-2 [&_button]:focus-visible:outline-[#0f62fe]">
      <div className="bg-white border-b border-[#e0e0e0] flex min-h-14 flex-wrap gap-3 items-center justify-between py-3 px-6 w-full shrink-0">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="bg-[#0f62fe] flex items-center justify-center rounded-[2px] size-8 shrink-0">
            <img alt="" className="size-5" src={imgBrainCog} />
          </div>
          <p className="font-sans font-semibold text-[#161616] text-[16px]">BOB Agent Setup</p>
          <span className="rounded-[2px] border border-[#e0e0e0] px-3 py-2 font-mono text-[13px] text-[#161616]">{SITE.id}</span>
          <span className="bg-[#edf5ff] px-2 py-1 rounded-[2px] text-[11px] font-semibold text-[#0f62fe]">{status}</span>
        </div>
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex gap-1.5 items-center">
            <img alt="" className="size-1.5" src={imgEllipse} />
            <p className="font-sans font-medium text-[#525252] text-[13px]">Telemetry {site.live?.connected ? 'connected' : 'not connected'}</p>
          </div>
          <button onClick={onClose} aria-label="Exit setup" className="border border-[#e0e0e0] flex items-center justify-center rounded-[2px] size-8 shrink-0 hover:bg-[#f4f4f4] transition-colors cursor-pointer">
            <img alt="" className="size-4" src={imgXCircle} />
          </button>
        </div>
      </div>

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
                <div className={`flex items-center justify-center rounded-[2px] size-5 font-mono text-[11px] ${s.state === 'done' ? 'bg-[#0f62fe] text-white font-semibold' : s.state === 'active' ? 'bg-white border-2 border-[#0f62fe] text-[#0f62fe] font-bold' : 'bg-white border border-[#e0e0e0] text-[#8d8d8d]'}`}>{s.num}</div>
                <p className={`font-sans font-semibold text-[13px] ${s.state === 'pending' ? 'text-[#8d8d8d]' : 'text-[#0f62fe]'}`}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="font-sans font-medium text-[#525252] text-[13px]"><span className="font-mono font-semibold">{confirmed.size}</span> of <span className="font-mono">{STEPS.length}</span> configuration decisions completed</p>
      </div>

      <div className="grid flex-1 min-h-0 min-w-0 w-full lg:grid-cols-[minmax(0,65fr)_minmax(0,35fr)]">
        <div className="flex flex-col min-w-0 min-h-0">
          <section aria-label="Configuration cards" className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 md:p-6 lg:p-8"><div className="flex min-w-0 flex-col gap-6">
            {phase === 'welcome' && <WelcomeCard choices={choices} onStart={start} />}
            {phase !== 'welcome' && values && asset && (
              <>
                <ChecklistCard confirmedSet={confirmed} activeStep={activeStep} phase={phase} />
                <StepCard title="What should this action prioritize?" hint="Recorded with the configuration for the people who review it; BOB’s operating mode decides the trade-offs in its plans." confirmed={isConfirmed(0)} onConfirm={() => confirmStep(0)}>
                  <div role="radiogroup" aria-label="Objective selection" className="flex flex-col gap-2">
                    {PRIORITIES.map(p => <RadioCard key={p.id} id={p.id} label={p.label} recommended={p.recommended} selected={values.preferences.objective === p.id} onChange={() => setPreferences({ objective: p.id })} />)}
                  </div>
                </StepCard>
                {isConfirmed(0) && (
                  <StepCard title="Which action should BOB take, on which asset?" confirmed={isConfirmed(1)} onConfirm={() => confirmStep(1)}>
                    <div role="radiogroup" aria-label="Asset and action" className="flex flex-col gap-2">
                      {choices.map(c => {
                        const live = site.live?.batteries.find((x) => x.code === c.asset.code);
                        return <RadioCard key={`${c.asset.code}:${c.kind}`} id={`${c.asset.code}:${c.kind}`} label={`${configKindLabel(c.kind)} · ${c.asset.name} · ${c.asset.capacity_mw} MW${live ? ` · ${live.soc_pct}% charged${live.available ? '' : ' · unavailable'}` : ''}`} selected={choice?.asset === c.asset.code && kind === c.kind} onChange={() => pick(c.asset.code, c.kind)} />;
                      })}
                    </div>
                  </StepCard>
                )}
                {isConfirmed(1) && (
                  <StepCard title="When should this action start?" hint="Time is counted in 15-minute blocks. A watch condition makes BOB re-plan as soon as it is crossed." confirmed={isConfirmed(2)} onConfirm={() => confirmStep(2)}>
                    {kind === 'battery_discharge' && <>
                      <div role="radiogroup" aria-label="Start condition" className="flex flex-col gap-2">
                        <RadioCard id="plan" label="Whenever BOB’s plan calls for it" selected={limits.deficit_mw === undefined} onChange={() => { const { deficit_mw: _, deficit_minutes: __, ...rest } = limits; setLimits(rest); }} />
                        <RadioCard id="deficit" label="Only while the portfolio is short of renewables" recommended selected={limits.deficit_mw !== undefined} onChange={() => setLimits({ ...limits, deficit_mw: limits.deficit_mw ?? 3, deficit_minutes: limits.deficit_minutes ?? 15 })} />
                      </div>
                      {limits.deficit_mw !== undefined && (
                        <div className="flex flex-col gap-3 bg-[#f4f4f4] border border-[#e0e0e0] p-4 rounded-[2px]">
                          <NumInput label="Portfolio short of renewables by more than" value={limits.deficit_mw} min={0} max={200} step={1} unit="MW" onChange={(v) => setLimits({ ...limits, deficit_mw: v })} />
                          <div className="bg-[#e0e0e0] h-px w-full" />
                          <NumInput label="Sustained for at least" value={limits.deficit_minutes ?? 0} min={0} max={60} step={15} unit="min" onChange={(v) => setLimits({ ...limits, deficit_minutes: v })} />
                        </div>
                      )}
                    </>}
                    {kind !== 'battery_discharge' && <p className="text-[13px] text-[#525252]">BOB takes this action whenever its plan calls for it, within the limits you set next.</p>}
                    {watchable.length > 0 && (
                      <div role="radiogroup" aria-label="Watch condition" className="flex flex-col gap-2">
                        <RadioCard id="no-watch" label="No watch condition" selected={!watch} onChange={() => setValues({ ...values, watch: [] })} />
                        {watchable.map((a) => (
                          <RadioCard key={a.code} id={`watch-${a.code}`} label={`Re-plan on ${a.name}: ${a.watch_label}`} selected={watched?.code === a.code}
                            onChange={() => setValues({ ...values, watch: [{ metric: a.watch_metric!, value: a.watch_metric === 'soc_below_pct' ? 30 : 5, asset: a.code === asset.code ? null : a.code }] })} />
                        ))}
                        {watch && watched && (
                          <div className="bg-[#f4f4f4] border border-[#e0e0e0] p-4 rounded-[2px] flex flex-col gap-3">
                            <NumInput label={watched.watch_label ?? 'Threshold'} value={watch.value} min={0} max={watch.metric === 'soc_below_pct' ? 100 : watched.capacity_mw} step={watch.metric === 'soc_below_pct' ? 5 : 1} unit={watch.metric === 'soc_below_pct' ? '%' : 'MW'} onChange={(v) => setValues({ ...values, watch: [{ ...watch, value: v }] })} />
                            <p className="text-[13px] text-[#525252]">When {watchLabel(watch, asset.name, names)}, BOB re-plans and may {configKindLabel(kind).toLowerCase()} on {asset.name} within the limits you set next.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </StepCard>
                )}
                {isConfirmed(2) && (
                  <StepCard title="What are the limits?" confirmed={isConfirmed(3)} onConfirm={() => confirmStep(3)}
                    hint={`${asset.name} is rated ${asset.capacity_mw} MW${reading ? ` and ${mwh(reading.energy_mwh)}` : ''}.${'reserve_pct' in limits && options?.protected.battery_soc_floor_pct !== undefined ? ` The organisation’s ${options.protected.battery_soc_floor_pct}% floor is locked.` : ''}${options?.protected.approval_above_mw !== undefined ? ` Above ${options.protected.approval_above_mw} MW a person always approves.` : ''}`}>
                    <div className="flex flex-col gap-3 bg-[#f4f4f4] border border-[#e0e0e0] p-4 rounded-[2px]">
                      {Object.keys(limits).filter((key) => key in LIMIT_INPUTS).map((key, i) => {
                        const input = LIMIT_INPUTS[key];
                        const bounds = { rating: asset.capacity_mw, ceiling: Math.min(asset.capacity_mw, options?.protected.approval_above_mw ?? asset.capacity_mw), floor: options?.protected.battery_soc_floor_pct ?? 0, energy: reading?.energy_mwh ?? 20 };
                        return <div key={key} className="flex flex-col gap-3">{i > 0 && <div className="bg-[#e0e0e0] h-px w-full" />}<NumInput label={input.label} value={limits[key]} min={input.min(bounds)} max={input.max(bounds)} step={input.step} unit={input.unit} onChange={(v) => setLimits({ ...limits, [key]: v })} /></div>;
                      })}
                    </div>
                  </StepCard>
                )}
                {isConfirmed(3) && (
                  <StepCard title="Automation and approvals" hint="Above the automatic limit, BOB asks the approver and keeps a safe fallback until they answer." confirmed={isConfirmed(4)} onConfirm={() => confirmStep(4)}>
                    <div role="radiogroup" aria-label="Autonomy" className="flex flex-col gap-2">
                      {(['auto', 'approval', 'recommend'] as const).map(id => <RadioCard key={id} id={id} label={`${AUTONOMY[id].label} — ${AUTONOMY[id].detail}`} recommended={id === 'auto'} selected={values.autonomy === id} onChange={() => setValues({ ...values, autonomy: id })} />)}
                    </div>
                    <div className="bg-[#f4f4f4] border border-[#e0e0e0] p-4 rounded-[2px]">
                      <NumInput label="The approver has" value={values.approval.response_min ?? 10} min={5} max={30} step={5} unit="min" onChange={(v) => setValues({ ...values, approval: { ...values.approval, response_min: v } })} />
                    </div>
                  </StepCard>
                )}
                {isConfirmed(4) && (
                  <StepCard title={`What should happen if ${asset.name} becomes unavailable during the action?`} hint="Recorded with the configuration for the operators; BOB re-plans without the asset either way." confirmed={isConfirmed(5)} onConfirm={() => confirmStep(5)}>
                    <div role="radiogroup" aria-label="Recovery behavior" className="flex flex-col gap-2">
                      {RECOVERY_OPTIONS.map(opt => <RadioCard key={opt.id} id={opt.id} label={opt.label} recommended={opt.recommended} selected={values.preferences.recovery === opt.id} onChange={() => setPreferences({ recovery: opt.id })} />)}
                    </div>
                  </StepCard>
                )}
                {isConfirmed(5) && (
                  <StepCard title="Who should be notified when this action runs?" hint="Recorded with the configuration; this demo has no notification service to send them." confirmed={isConfirmed(6)} onConfirm={() => confirmStep(6)}>
                    <div className="flex flex-col gap-2">
                      {NOTIFICATION_OPTIONS.map(opt => {
                        const on = values.preferences.notify.includes(opt.id);
                        return (
                          <button key={opt.id} onClick={() => setPreferences({ notify: on ? values.preferences.notify.filter(v => v !== opt.id) : [...values.preferences.notify, opt.id] })}
                            className={`flex gap-3 items-center p-3.5 rounded-[2px] border w-full text-left transition-all cursor-pointer ${on ? 'border-[#0f62fe] bg-[#edf5ff]' : 'border-[#e0e0e0] bg-white hover:border-[#0f62fe]'}`}>
                            <div className={`flex items-center justify-center rounded-[2px] size-[18px] border-2 shrink-0 ${on ? 'border-[#0f62fe] bg-[#0f62fe]' : 'border-[#8d8d8d] bg-white'}`}>
                              {on && <img alt="" className="size-3" src={imgCheck} />}
                            </div>
                            <p className="font-sans font-medium text-[#161616] text-[13px]">{opt.label}</p>
                          </button>
                        );
                      })}
                    </div>
                  </StepCard>
                )}
                {isConfirmed(6) && (
                  <>
                    <div className="flex gap-3 items-start w-full">
                      <BobAvatar small />
                      <div className="bg-[#e8f1ff] border border-[#0f62fe]/20 flex gap-3 items-center p-4 rounded-[2px] flex-1 min-w-0">
                        <div className="bg-[#0f62fe] flex items-center justify-center rounded-full size-5 shrink-0"><img alt="" className="size-3" src={imgCheck1} /></div>
                        <div className="flex flex-col gap-1 flex-1">
                          <p className="font-semibold text-[#0f62fe] text-[14px]">Configuration complete — 7 of 7 decisions</p>
                          <p className="text-[#1e3a8a] text-[13px]">Saving creates a draft. It takes effect only after it passes the tests and you activate it.</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button disabled={saving} onClick={() => void save()} className="bg-[#0f62fe] flex items-center gap-2 px-5 py-2.5 rounded-[2px] hover:bg-[#0043ce] transition-colors cursor-pointer disabled:opacity-60">
                        <p className="font-semibold text-white text-[14px]">{saving ? 'Saving…' : 'Save draft and review'}</p>
                        <img alt="" className="size-4" src={imgArrowRight} />
                      </button>
                    </div>
                  </>
                )}
              </>
            )}

            <div className="bg-white border border-[#e0e0e0] flex flex-col w-full rounded-[2px] overflow-hidden">
              <div className="border-b border-[#e0e0e0] flex flex-wrap gap-3 items-center justify-between px-5 py-4 shrink-0">
                <p className="font-sans font-semibold text-[#161616] text-[15px]">{asset ? `${configKindLabel(kind)} · ${asset.name}` : 'Action configuration'}</p>
                <span className="bg-[#edf5ff] px-2 py-1 rounded-[2px] text-[11px] font-semibold text-[#0f62fe]">{status}</span>
              </div>
              {phase === 'welcome' ? <div className="m-5 bg-[#f4f4f4] border border-[#e0e0e0] p-6"><h2 className="mb-3 text-[16px] font-semibold text-[#161616]">Not started</h2><p className="text-[14px] leading-relaxed text-[#525252]">Choose an action, or describe it to BOB. Each starts from the action’s current configuration.</p></div> : <div className="flex flex-col gap-5 p-5 overflow-y-auto flex-1">
                <div className="bg-[#e0e0e0] h-1.5 rounded-full w-full overflow-hidden">
                  <div className="bg-[#0f62fe] h-full rounded-full transition-all" style={{ width: `${(confirmed.size / STEPS.length) * 100}%` }} />
                </div>
                <div className="flex flex-col gap-3">
                  {STEPS.map((step, i) => {
                    const state = itemStatus(i);
                    return (
                      <div key={step} className="flex gap-3 items-start">
                        {state === 'done' ? <div className="bg-[#198038] flex items-center justify-center rounded-[2px] size-[18px] shrink-0 mt-0.5"><img alt="" className="size-3" src={imgCheck1} /></div>
                          : state === 'inProgress' ? <img alt="" className="size-[18px] shrink-0 mt-0.5" src={imgFrame1} />
                          : <div className="border border-[#e0e0e0] rounded-[2px] size-[18px] shrink-0 mt-0.5" />}
                        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                          <p className={`font-sans ${state === 'done' ? 'font-medium' : 'font-normal'} text-[13px] ${state === 'missing' ? 'text-[#8d8d8d]' : 'text-[#161616]'}`}>{step}</p>
                          {state === 'done' && <p className="font-sans font-normal text-[#525252] text-[12px]">{summary(i)}</p>}
                        </div>
                        {state === 'done' && <button onClick={() => editFrom(i)} className="text-[12px] text-[#0f62fe] hover:text-[#0043ce] hover:underline cursor-pointer" aria-label={`Edit ${step}`}>Edit</button>}
                      </div>
                    );
                  })}
                </div>
                <div className="bg-[#fef3c7] border border-[#f59e0b]/40 p-4 rounded-[2px]">
                  <p className="font-sans font-semibold text-[#78350f] text-[12px] mb-2">Protected limits (cannot be overridden)</p>
                  <Link to="/protected" className="inline-flex min-h-11 items-center text-sm text-[#0f62fe] hover:text-[#0043ce] underline">View protected boundary</Link>
                  {options?.protected.battery_soc_floor_pct !== undefined && <p className="text-[#78350f] text-[12px]">Battery floor: <span className="font-mono font-semibold">{options.protected.battery_soc_floor_pct}% SOC</span> — locked</p>}
                  {options?.protected.approval_above_mw !== undefined && <p className="text-[#78350f] text-[12px]">Approval always required above <span className="font-mono font-semibold">{options.protected.approval_above_mw} MW</span></p>}
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
    {boundary && <div role="alert" className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-xl border-l-4 border-[#da1e28] bg-white p-5 shadow-lg"><h2 className="font-semibold text-[#da1e28]">Configuration not accepted</h2><p className="my-3 text-sm">{boundary} Effective policy is unchanged.</p><div className="flex flex-wrap gap-4 text-sm"><Link to="/protected" className="text-[#0f62fe] underline">Inspect rule</Link><button onClick={() => { setBoundary(''); editFrom(3); }}>Choose safe limits</button><button onClick={() => setBoundary('')}>Cancel</button></div></div>}
    </BobAskContext.Provider></BoundaryContext.Provider>
  );
}

// ─── Sub-cards ────────────────────────────────────────────────────────────────

function WelcomeCard({ choices, onStart }: { choices: Array<{ asset: ConfigOptions['assets'][number]; kind: string }>; onStart: (code: string, kind: string) => void }) {
  const ask = useContext(BobAskContext);
  const { live, configs, siteName } = useSite();
  const [request, setRequest] = useState('');
  const sources = useQuery({ queryKey: ['data-sources', SITE.id], queryFn: () => siteApi.sources(SITE.id) }).data ?? [];
  const status = (code: string, kind: string) => configs.find((c) => c.asset === code && c.kind === kind)?.status;
  return (
    <div className="bg-white border border-[#e0e0e0] flex flex-col gap-5 p-5 rounded-[2px] w-full font-sans">
      <div className="flex flex-wrap gap-3 items-center">
        <BobAvatar />
        <div>
          <p className="font-sans font-semibold text-[#161616] text-[14px]">BOB</p>
          <p className="font-sans font-normal text-[#8d8d8d] text-[12px]">AI energy assistant</p>
        </div>
      </div>
      <p className="font-sans font-normal text-[#161616] text-[15px] leading-relaxed">Let's configure what I can do for {siteName}. Pick an action below, or tell me what you want and I'll draft it.</p>
      <form onSubmit={(e) => { e.preventDefault(); if (request.trim()) { ask(request.trim()); setRequest(''); } }} className="flex flex-col gap-2 border border-[#a6c8ff] bg-[#edf5ff] p-4 rounded-[2px]">
        <label htmlFor="describe-action" className="text-[13px] font-semibold text-[#161616]">Describe it to BOB</label>
        <textarea id="describe-action" rows={2} value={request} onChange={(e) => setRequest(e.target.value)} placeholder="e.g. Let Battery 1 discharge at most 30 minutes at a time, only when the portfolio is short by more than 5 MW"
          className="min-h-14 resize-y rounded-t-[2px] border-b border-[#8d8d8d] bg-white px-3 py-2 text-[14px] text-[#161616] focus:outline-2 focus:outline-[#0f62fe]" />
        <button type="submit" disabled={!request.trim()} className="self-start bg-[#0f62fe] px-4 py-2.5 rounded-[2px] text-[13px] font-semibold text-white hover:bg-[#0043ce] disabled:opacity-60 cursor-pointer">Draft it with BOB</button>
        <p className="text-[12px] text-[#525252]">BOB drafts and tests it; open its draft card to review and activate.</p>
      </form>
      <div className="border border-[#e0e0e0] bg-[#f4f4f4] p-4 rounded-[2px]">
        <h2 className="mb-4 text-[14px] font-semibold text-[#161616]">Prerequisites</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[
            ['Site', siteName, SITE.id],
            ['Telemetry', live?.connected ? 'Connected' : 'Not connected', live?.connected ? 'BOB acts on the live feed' : 'BOB only monitors until the feed is connected'],
            ['Data sources', `${sources.length} connected`, sources.map((s) => s.kind === 'api' ? 'Live API' : 'CSV').join(', ') || 'None yet'],
            ['Configured actions', `${configs.length}`, `${configs.filter((c) => c.status === 'active').length} active`],
          ].map(([name, value, detail]) => <div key={name} className="border border-[#e0e0e0] bg-white p-3 rounded-[2px]"><p className="mb-1 text-[11px] text-[#8d8d8d]">{name}</p><p className="mb-1 text-[13px] font-semibold text-[#161616]">{value}</p><p className="text-[12px] leading-relaxed text-[#525252]">{detail}</p></div>)}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {choices.map(({ asset, kind }) => (
          <button key={`${asset.code}:${kind}`} onClick={() => onStart(asset.code, kind)}
            className="flex flex-col gap-2 p-4 rounded-[2px] border border-[#e0e0e0] bg-white text-left transition-all cursor-pointer hover:border-[#0f62fe]">
            <div className="flex items-start justify-between gap-2">
              <p className="font-sans font-semibold text-[#161616] text-[13px] leading-normal flex-1">{configKindLabel(kind)}</p>
              <span className="bg-[#f4f4f4] border border-[#e0e0e0] px-1.5 py-0.5 rounded-[2px] text-[10px] font-semibold text-[#525252] capitalize">{status(asset.code, kind) ?? 'not set up'}</span>
            </div>
            <p className="text-[12px] text-[#525252]">{asset.name} · {asset.capacity_mw} MW</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function ChecklistCard({ confirmedSet, activeStep, phase }: { confirmedSet: Set<ConfigStep>; activeStep: ConfigStep; phase: ChatPhase }) {
  return (
    <div className="flex gap-3 items-start w-full font-sans">
      <BobAvatar small />
      <div className="flex flex-col gap-3 flex-1">
        <p className="font-sans font-normal text-[#161616] text-[14px] leading-normal">I'll guide you through <span className="font-mono font-semibold">{STEPS.length}</span> configuration decisions for this action.</p>
        <div className="bg-white border border-[#e0e0e0] flex flex-col gap-2.5 p-4 rounded-[2px]">
          {STEPS.map((step, i) => {
            const done = confirmedSet.has(i as ConfigStep);
            const inProg = phase !== 'welcome' && i === activeStep && !done;
            return (
              <div key={step} className="flex flex-wrap gap-3 items-center">
                {done ? <div className="bg-[#198038] flex items-center justify-center rounded-[2px] size-[18px] shrink-0"><img alt="" className="size-3" src={imgCheck} /></div>
                  : inProg ? <img alt="" className="size-[18px] shrink-0" src={imgFrame1} />
                  : <div className="border border-[#e0e0e0] rounded-[2px] size-[18px] shrink-0" />}
                <p className={`font-sans ${done ? 'font-medium' : 'font-normal'} text-[13px] ${!done && !inProg ? 'text-[#8d8d8d]' : 'text-[#161616]'}`}>{step}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

