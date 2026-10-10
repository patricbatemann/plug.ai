import { useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { configApi, type ConfigOut, type ConfigValues } from './api/client';
import { AUTONOMY, NOTIFY, OBJECTIVES, RECOVERY } from './format';

const assetPathPrefix = '/assets';
const imgBrainCog = `${assetPathPrefix}/71557.svg`;
const imgXCircle = `${assetPathPrefix}/179e0.svg`;
const imgCheck1 = `${assetPathPrefix}/f6f5a.svg`;
const imgArrowRight = `${assetPathPrefix}/21c0f.svg`;

const STAGES = ['Select action', 'Configure', 'Test', 'Activate'];

const LIMITS: Array<[string, string, string]> = [
  ['auto_max_mw', 'Automatic up to', 'MW'],
  ['max_mw', 'Never more than', 'MW'],
  ['reserve_pct', 'Stops at reserve', '%'],
  ['max_minutes', 'Continuous discharge at most', 'min'],
  ['max_mwh', 'Energy in that time at most', 'MWh'],
  ['deficit_mw', 'Only while the portfolio is short by more than', 'MW'],
  ['deficit_minutes', 'Sustained for at least', 'min'],
];

/** What the configuration says, as label/value rows, so a draft can be compared with the version in force. */
function describe(v: ConfigValues): Array<[string, string]> {
  return [
    ['Autonomy', AUTONOMY[v.autonomy].label],
    ...LIMITS.map(([key, label, unit]): [string, string] => [label, v.limits[key] === undefined ? '—' : `${v.limits[key]} ${unit}`]),
    ['Approver answers within', `${v.approval.response_min ?? 10} min`],
    ['Objective', OBJECTIVES[v.preferences.objective]],
    ['If the battery fails', RECOVERY[v.preferences.recovery]],
    ['Notify', v.preferences.notify.map((n) => NOTIFY[n]).join('; ') || 'Nobody'],
  ];
}

function useConfig(id: number, site: string): ConfigOut | undefined {
  return useQuery({ queryKey: ['configs', site], queryFn: () => configApi.list(site) }).data?.find((c) => c.id === id);
}

function Frame({ site, stage, status, onClose, children }: { site: string; stage: number; status: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="bg-[#f4f4f4] flex flex-col min-h-screen w-full font-sans">
      <div className="bg-white border-b border-[#e0e0e0] flex min-h-14 flex-wrap gap-3 items-center justify-between py-3 px-6 shrink-0">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="bg-[#0f62fe] flex items-center justify-center rounded-[2px] size-8"><img alt="" className="size-5" src={imgBrainCog} /></div>
          <p className="font-semibold text-[#161616] text-[16px]">BOB Agent Setup</p>
          <span className="border border-[#e0e0e0] px-2.5 py-1.5 rounded-[2px] font-mono text-[13px] text-[#161616]">{site}</span>
          <span className="bg-[#fef3c7] border border-[#fde68a] px-2 py-0.5 rounded-[2px] text-[11px] font-semibold text-[#b26207]">{status}</span>
        </div>
        <button onClick={onClose} aria-label="Exit setup" className="border border-[#e0e0e0] bg-white flex items-center justify-center rounded-[2px] size-8 hover:bg-[#f4f4f4] cursor-pointer">
          <img alt="" className="size-4" src={imgXCircle} />
        </button>
      </div>
      <div className="bg-white border-b border-[#e0e0e0] flex flex-wrap gap-3 items-center px-4 md:px-6 py-4 shrink-0">
        {STAGES.map((label, i) => (
          <div key={label} aria-current={i === stage ? 'step' : undefined} className="flex flex-wrap gap-3 items-center">
            {i > 0 && <div className="bg-[#e0e0e0] h-px w-10" />}
            <div className="flex gap-2 items-center">
              <div className={`flex items-center justify-center rounded-full size-5 text-[11px] font-semibold ${i < stage ? 'bg-[#0f62fe] text-white' : i === stage ? 'bg-white border-2 border-[#0f62fe] text-[#0f62fe]' : 'bg-white border border-[#e0e0e0] text-[#8d8d8d]'}`}>{i + 1}</div>
              <p className={`font-semibold text-[13px] ${i > stage ? 'text-[#8d8d8d]' : 'text-[#0f62fe]'}`}>{label}</p>
            </div>
          </div>
        ))}
      </div>
      <main className="flex-1 min-w-0 overflow-y-auto p-4 md:p-8"><div className="max-w-2xl mx-auto flex flex-col gap-6">{children}</div></main>
    </div>
  );
}

function Primary({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled} className="bg-[#0f62fe] flex items-center gap-2 px-5 py-2.5 rounded-[2px] hover:bg-[#0043ce] transition-colors cursor-pointer disabled:opacity-60 self-start">
      <span className="font-semibold text-white text-[14px]">{children}</span>
      <img alt="" className="size-4" src={imgArrowRight} />
    </button>
  );
}

function Secondary({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return <button onClick={onClick} className="border border-[#e0e0e0] bg-white px-5 py-2.5 rounded-[2px] hover:bg-[#f4f4f4] cursor-pointer text-[14px] font-medium text-[#161616]">{children}</button>;
}

function Missing({ site, onClose }: { site: string; onClose: () => void }) {
  return <Frame site={site} stage={1} status="Not found" onClose={onClose}><p className="text-[14px] text-[#525252]">This configuration is not a draft at this site any more. Start again from the BOB actions.</p></Frame>;
}

export function ReviewConfig({ id, site, onEdit, onTest, onClose }: { id: number; site: string; onEdit: () => void; onTest: () => void; onClose: () => void }) {
  const config = useConfig(id, site);
  if (!config) return <Missing site={site} onClose={onClose} />;
  const before = config.active ? Object.fromEntries(describe(config.active)) : {};
  return (
    <Frame site={site} stage={2} status="Ready to test" onClose={onClose}>
      <div>
        <h1 className="font-bold text-[#1f2937] text-[22px] mb-1">Review configuration</h1>
        <p className="text-[#525252] text-[14px]">{config.name} · {config.asset_name} · draft version {config.version}. {config.active ? 'Changes from the version in force are highlighted.' : 'Nothing is in force for this action yet.'}</p>
      </div>
      <div className="bg-white border border-[#e0e0e0] rounded-[2px] px-5 py-4">
        {describe(config).map(([label, value]) => {
          const changed = config.active && before[label] !== value;
          return (
            <div key={label} className="flex items-start justify-between gap-4 py-1.5 border-b border-[#f4f4f4] last:border-0">
              <p className="text-[#525252] text-[13px]">{label}</p>
              <p className={`text-[13px] text-right ${changed ? 'font-semibold text-[#0f62fe]' : 'font-medium text-[#161616]'}`}>
                {value}{changed && <span className="block font-normal text-[#8d8d8d]">was {before[label]}</span>}
              </p>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3">
        <Primary onClick={onTest}>Run the tests</Primary>
        <Secondary onClick={onEdit}>Edit</Secondary>
      </div>
    </Frame>
  );
}

export function TestConfig({ id, site, onEdit, onActivate, onClose }: { id: number; site: string; onEdit: () => void; onActivate: () => void; onClose: () => void }) {
  const config = useConfig(id, site);
  const queryClient = useQueryClient();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  if (!config) return <Missing site={site} onClose={onClose} />;
  const tests = Object.values(config.tests);
  const passed = tests.length > 0 && tests.every((t) => t.passed);
  const run = async () => {
    setRunning(true);
    setError('');
    try {
      await configApi.test(id);
      await queryClient.invalidateQueries({ queryKey: ['configs', site] });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The tests did not run.');
    } finally {
      setRunning(false);
    }
  };
  return (
    <Frame site={site} stage={2} status={tests.length ? (passed ? 'Tested' : 'Tests failed') : 'Ready to test'} onClose={onClose}>
      <div>
        <h1 className="font-bold text-[#1f2937] text-[22px] mb-1">Test against live conditions</h1>
        <p className="text-[#525252] text-[14px]">BOB plans the block in progress with this draft in force under three scenarios. Each plan must serve all load, and {config.asset_name}’s action must pass the safety checks. Nothing is sent to any asset.</p>
      </div>
      {error && <p role="alert" className="border-l-4 border-[#da1e28] bg-[#fff1f1] p-4 text-[13px] text-[#161616]">{error}</p>}
      {tests.length > 0 && (
        <div className="bg-white border border-[#e0e0e0] rounded-[2px] divide-y divide-[#f4f4f4]">
          {tests.map((t) => (
            <div key={t.label} className="flex gap-3 items-start px-5 py-4">
              <span className={`flex items-center justify-center rounded-[2px] size-5 shrink-0 text-[11px] font-bold text-white ${t.passed ? 'bg-[#198038]' : 'bg-[#da1e28]'}`}>{t.passed ? <img alt="" className="size-3" src={imgCheck1} /> : '✕'}</span>
              <div><p className="font-semibold text-[#161616] text-[14px]">{t.label}</p><p className="text-[#525252] text-[13px]">{t.detail}</p></div>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        {passed ? <Primary onClick={onActivate}>Continue to activation</Primary> : <Primary onClick={() => void run()} disabled={running}>{running ? 'Running…' : tests.length ? 'Run again' : 'Run the tests'}</Primary>}
        <Secondary onClick={onEdit}>Edit configuration</Secondary>
      </div>
    </Frame>
  );
}

export function ActivateConfig({ id, site, onDone, onClose }: { id: number; site: string; onDone: () => void; onClose: () => void }) {
  const config = useConfig(id, site);
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!config) return <Missing site={site} onClose={onClose} />;
  const active = config.current && config.status === 'active';
  const activate = async () => {
    setBusy(true);
    setError('');
    try {
      await configApi.activate(id);
      await queryClient.invalidateQueries({ queryKey: ['configs', site] });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Activation failed.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Frame site={site} stage={active ? 4 : 3} status={active ? 'Active' : 'Ready to activate'} onClose={onClose}>
      <div>
        <h1 className="font-bold text-[#1f2937] text-[22px] mb-1">{active ? 'Configuration active' : 'Confirm activation'}</h1>
        <p className="text-[#525252] text-[14px]">
          {active
            ? `Version ${config.version} of “${config.name}” is in force. BOB plans ${config.asset_name}’s discharge within it from the next block.`
            : `Version ${config.version} replaces the version in force for ${config.asset_name}. BOB plans within it from the next block.`}
        </p>
      </div>
      {error && <p role="alert" className="border-l-4 border-[#da1e28] bg-[#fff1f1] p-4 text-[13px] text-[#161616]">{error}</p>}
      <div className="bg-white border border-[#e0e0e0] rounded-[2px] px-5 py-4">
        {describe(config).filter(([, value]) => value !== '—').map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-4 py-1.5 border-b border-[#f4f4f4] last:border-0">
            <p className="text-[#525252] text-[13px]">{label}</p>
            <p className="font-medium text-[#161616] text-[13px] text-right">{value}</p>
          </div>
        ))}
      </div>
      {active ? <Primary onClick={onDone}>Open live monitoring</Primary> : <Primary onClick={() => void activate()} disabled={busy}>{busy ? 'Activating…' : 'Activate'}</Primary>}
    </Frame>
  );
}
