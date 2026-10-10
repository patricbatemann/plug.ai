import { useState } from 'react';
import { Link } from 'react-router';
import { useBobChat, BobMessages, BobComposer, BobChatScrollArea, BobNewChat } from './BobChat';
import type { FlowItem } from './api/client';
import ApprovalCard from './ApprovalCard';
import { SITE } from './data';
import { actionLabel, mw, mwh, simDateTime, statusOf } from './format';
import { useSite } from './site';

const assetPathPrefix = '/assets';
const imgBrainCog = `${assetPathPrefix}/71557.svg`;
const imgEllipse = `${assetPathPrefix}/2ea7c.svg`;
const imgBot = `${assetPathPrefix}/0d037.svg`;
const imgXCircle = `${assetPathPrefix}/179e0.svg`;

function ibm(w: 'Regular' | 'Medium' | 'SemiBold' | 'Bold', extra = '') {
  const wMap = { Regular: 'font-normal', Medium: 'font-medium', SemiBold: 'font-semibold', Bold: 'font-bold' };
  return { className: `font-sans ${wMap[w]} ${extra}` };
}

const COLORS = ['#b26207', '#0f62fe', '#525252', '#198038'];

/** Where the site's power comes from and where it goes, in the last settled block. */
function FlowBar({ sources, uses }: { sources: FlowItem[]; uses: FlowItem[] }) {
  const total = Math.max(sources.reduce((sum, s) => sum + s.mw, 0), 0.1);
  const bars = (items: FlowItem[]) => items.map((item, i) => (
    <div key={item.label} className="flex flex-col items-center gap-1.5 flex-1">
      <p {...ibm('Bold', 'text-[16px] font-mono')} style={{ color: COLORS[i % COLORS.length] }}>{mw(Math.abs(item.mw))}</p>
      <div className="w-full rounded-t-[2px]" style={{ height: `${(Math.abs(item.mw) / total) * 80}px`, backgroundColor: COLORS[i % COLORS.length], opacity: item.mw ? 1 : 0.2 }} />
      <p {...ibm('Regular', 'text-[#525252] text-[11px] text-center')}>{item.label}</p>
    </div>
  ));
  return (
    <div className="bg-[#f4f4f4] border border-[#e0e0e0] p-5 rounded-[2px]">
      <div className="flex items-end gap-2">
        {bars(sources)}
        <div className="flex items-center self-center text-[#8d8d8d] font-mono text-[20px]">=</div>
        {bars(uses)}
      </div>
    </div>
  );
}

export default function ActiveMonitoring({ onBack, onApprovalReview }: { onBack: () => void; onApprovalReview: () => void }) {
  const { run, live, approvals, activity, battery, reservePct, floorPct, bobActive, siteName } = useSite();
  const [askBobOpen, setAskBobOpen] = useState(false);
  const chat = useBobChat(`${SITE.id}, monitoring screen`);
  const usable = battery && reservePct !== null ? Math.max(0, ((battery.soc_pct - reservePct) / 100) * battery.energy_mwh) : null;

  return (
    <div className="bg-[#f4f4f4] flex flex-col min-h-screen w-full font-sans">
      <div className="bg-white border-b border-[#e0e0e0] flex min-h-14 flex-wrap gap-3 items-center justify-between py-3 px-6 shrink-0">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="bg-[#0f62fe] flex items-center justify-center rounded-[2px] size-8">
            <img alt="" className="size-5" src={imgBrainCog} />
          </div>
          <p {...ibm('SemiBold', 'text-[#161616] text-[16px]')}>{siteName}</p>
          <div className={`px-2 py-1 rounded-[2px] border ${live?.connected && bobActive ? 'bg-[#defbe6] border-[#198038]/40' : 'bg-[#f4f4f4] border-[#e0e0e0]'}`}>
            <p {...ibm('SemiBold', `text-[11px] font-mono tracking-tight ${live?.connected && bobActive ? 'text-[#198038]' : 'text-[#525252]'}`)}>
              {!live?.connected ? 'Monitoring only' : bobActive ? 'BOB acting' : 'BOB paused'}
            </p>
          </div>
          {live && (
            <div className="flex gap-1.5 items-center">
              <img alt="" className="size-1.5" src={imgEllipse} />
              <p {...ibm('Regular', 'text-[#525252] text-[13px]')}>Live · <span className="font-mono">{simDateTime(live.sim_time)} IST</span></p>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <button onClick={() => setAskBobOpen(!askBobOpen)} className="bg-[#0f62fe] flex items-center gap-2 px-3 py-1.5 rounded-[2px] hover:bg-[#0043ce] transition-colors cursor-pointer text-white">
            <img alt="" className="size-4" src={imgBot} />
            <p {...ibm('SemiBold', 'text-white text-[13px]')}>Ask BOB</p>
          </button>
          <button onClick={onBack} className="border border-[#e0e0e0] px-3 py-1.5 rounded-[2px] hover:bg-[#f4f4f4] transition-colors cursor-pointer">
            <p {...ibm('Medium', 'text-[#161616] text-[13px]')}>Back to site</p>
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col lg:flex-row min-w-0">
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex flex-col gap-6">
            <div className="bg-white border border-[#e0e0e0] p-5 rounded-[2px]">
              <p {...ibm('Bold', 'text-[#161616] text-[18px]')}>What BOB is doing now</p>
              <ul className="mt-2 mb-4 list-disc pl-5">
                {(live?.bob_now.length ? live.bob_now : ['Nothing at this site in this block']).map((line) => (
                  <li key={line} {...ibm('Regular', 'text-[#525252] text-[13px]')}>{line}</li>
                ))}
              </ul>
              {live && <FlowBar sources={live.sources} uses={live.uses} />}
              {live?.replanned && <p {...ibm('Regular', 'text-[#525252] text-[12px] mt-3')}>Latest re-plan: {live.replanned}</p>}
            </div>

            {approvals.length > 0 && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p {...ibm('SemiBold', 'text-[#161616] text-[14px]')}>Waiting for your approval</p>
                  <button onClick={onApprovalReview} className="text-[13px] text-[#0f62fe] underline cursor-pointer">Open approvals</button>
                </div>
                {run && approvals.map((action) => <ApprovalCard key={action.id} action={action} runId={run.id} />)}
              </div>
            )}

            {battery && (
              <div className="bg-white border border-[#e0e0e0] p-5 rounded-[2px]">
                <p {...ibm('SemiBold', 'text-[#161616] text-[14px] mb-4')}>{battery.name} status</p>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap gap-3 items-center justify-between">
                    <p {...ibm('Regular', 'text-[#525252] text-[13px]')}>State of charge</p>
                    <p {...ibm('Bold', 'text-[#161616] font-mono text-[16px]')}>{battery.soc_pct}%</p>
                  </div>
                  <div className="bg-[#f4f4f4] rounded-[2px] h-3 overflow-hidden relative border border-[#e0e0e0]">
                    {floorPct !== null && <div className="absolute top-0 h-full w-px bg-[#da1e28] z-10" style={{ left: `${floorPct}%` }} />}
                    {reservePct !== null && <div className="absolute top-0 h-full w-px bg-[#b26207]" style={{ left: `${reservePct}%` }} />}
                    <div className="h-full rounded-none transition-all" style={{ width: `${battery.soc_pct}%`, background: 'linear-gradient(90deg, #198038 60%, #0f62fe)' }} />
                  </div>
                  <div className="flex justify-between text-[11px] font-mono">
                    {floorPct !== null && <span {...ibm('Regular', 'text-[#da1e28]')}>Locked floor: {floorPct}%</span>}
                    {reservePct !== null && <span {...ibm('Regular', 'text-[#b26207]')}>Reserve: {reservePct}%</span>}
                    <span {...ibm('Regular', 'text-[#198038]')}>Current: {battery.soc_pct}%</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
                    {[
                      { label: `${battery.mw < 0 ? 'Charge' : 'Discharge'} rate, last block`, value: mw(Math.abs(battery.mw)) },
                      { label: 'Usable above reserve', value: usable === null ? '—' : mwh(usable) },
                      { label: 'Runtime at this rate', value: usable !== null && battery.mw > 0 ? `~${Math.round((usable / battery.mw) * 60)} min` : '—' },
                    ].map(item => (
                      <div key={item.label} className="bg-[#f4f4f4] border border-[#e0e0e0] p-3 rounded-[2px]">
                        <p {...ibm('Regular', 'text-[#525252] text-[11px]')}>{item.label}</p>
                        <p {...ibm('SemiBold', 'text-[#161616] font-mono text-[14px]')}>{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-4 text-sm text-[#0f62fe]"><Link to="/askBob" className="hover:text-[#0043ce] underline">Ask BOB activity summary</Link><Link to="/bob" className="hover:text-[#0043ce] underline">View configured actions</Link><Link to="/protected" className="hover:text-[#0043ce] underline">View protected boundary</Link><Link to="/workOrder" className="hover:text-[#0043ce] underline">Open maintenance</Link><Link to="/connectData" className="hover:text-[#0043ce] underline">Connect data</Link></div>
            <div className="bg-white border border-[#e0e0e0] p-5 rounded-[2px]">
              <p {...ibm('SemiBold', 'text-[#161616] text-[14px] mb-4')}>Audit event log</p>
              {activity.length === 0 && <p {...ibm('Regular', 'text-[#525252] text-[13px]')}>Nothing recorded at this site yet in this run.</p>}
              <div className="flex flex-col gap-0">
                {activity.map((entry, i) => (
                  <div key={i} className="flex gap-4 border-b border-[#f4f4f4] last:border-0 py-3">
                    <p {...ibm('Regular', 'text-[#8d8d8d] font-mono text-[12px] whitespace-nowrap mt-0.5')}>{simDateTime(entry.at)}</p>
                    <div>
                      <p {...ibm('SemiBold', `text-[13px] ${entry.status === 'rejected' || entry.status === 'expired' ? 'text-[#da1e28]' : 'text-[#161616]'}`)}>{entry.title ?? (entry.kind ? `${actionLabel(entry.kind, entry.mw ?? 0)}${entry.mw ? ` ${mw(Math.abs(entry.mw))}` : ''}${entry.asset ? ` · ${entry.asset}` : ''} · ${statusOf(entry.status ?? '').label}` : entry.category)}</p>
                      <p {...ibm('Regular', 'text-[#525252] text-[12px] leading-normal')}>{entry.detail}{entry.by ? ` · ${entry.by}` : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {askBobOpen && (
          <div className="bg-white border-l border-[#e0e0e0] flex flex-col w-full lg:w-[360px] shrink-0">
            <div className="border-b border-[#e0e0e0] flex flex-wrap gap-3 items-center justify-between px-5 py-4">
              <div className="flex gap-2 items-center">
                <img alt="" className="size-4" src={imgBot} />
                <p {...ibm('SemiBold', 'text-[#161616] text-[14px]')}>Ask BOB</p>
              </div>
              <BobNewChat chat={chat} />
              <button onClick={() => setAskBobOpen(false)} aria-label="Close Ask BOB" className="hover:bg-[#f4f4f4] rounded-[2px] p-1 cursor-pointer transition-colors">
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
