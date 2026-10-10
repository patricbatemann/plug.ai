import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { BobChatScrollArea, BobMessages, BobNewChat, useBobChat } from './BobChat';
import { SITE } from './data';
import { batteryState, mw, simDateTime } from './format';
import { useSite } from './site';

const assets = '/assets/ask-bob';
const prompts = ['What is the current generation?', 'Show pending approvals', 'What is the battery state?', 'Summarize today’s operations', 'Open configured actions'];

function Avatar() {
  return <span className="flex size-7 shrink-0 items-center justify-center rounded-[2px] bg-[#0f62fe]"><img alt="" src={`${assets}/0d037.svg`} /></span>;
}

export default function AskBob() {
  const { live, approvals, battery, bobActive } = useSite();
  const navigate = useNavigate();
  const [draft, setDraft] = useState('');
  const input = useRef<HTMLTextAreaElement>(null);
  const chat = useBobChat('monitoring');
  const systemStatus = live?.connected ? 'Live telemetry' : 'Telemetry not connected';
  const ask = (text: string) => {
    if (text === 'Open configured actions') { navigate('/bob'); return; }
    if (chat.pending || chat.error) { setDraft(text); input.current?.focus(); return; }
    void chat.send(text);
    setDraft('');
  };
  const followUps = [
    ...approvals.map((a) => ({ title: `Decide: ${a.reason ?? a.kind}`, detail: a.deadline_at ? `Answer by ${simDateTime(a.deadline_at)} IST.` : 'Waiting for a person.', to: '/approval', action: 'Open' })),
    ...(live && !live.connected ? [{ title: 'Connect the site’s telemetry', detail: 'BOB only monitors a site until its live feed is connected.', to: '/connectData', action: 'Connect' }] : []),
    { title: bobActive ? 'Review configured actions' : 'Resume BOB’s actions', detail: bobActive ? 'Check the limits BOB acts within at this site.' : 'Every action at this site is paused.', to: '/bob', action: 'Review' },
  ];

  return (
    <main className="ask-bob flex h-full min-h-0 flex-col bg-[#f4f4f4] text-[#161616] font-sans">
      <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-4 border-b border-[#e0e0e0] bg-white px-4 py-3 md:px-6">
        <span className="flex size-8 items-center justify-center rounded-[2px] bg-[#0f62fe]"><img alt="" src={`${assets}/0b229.svg`} /></span>
        <h1 className="ask-semibold text-[16px] text-[#161616]">BOB Admin Assistant</h1>
        <span className="ask-semibold rounded-[2px] bg-[#edf5ff] border border-[#a6c8ff]/60 px-2 py-1 text-[11px] font-mono text-[#0f62fe]">{systemStatus}</span>
        <span className="ml-auto"><BobNewChat chat={chat} /></span>
      </header>
      <BobChatScrollArea className="flex-1 p-4 md:p-6" updateKey={`${chat.messages.length}:${chat.pending}:${chat.error}`} lastUserId={chat.messages.filter(message => message.role === 'user').at(-1)?.id}>
        <Link to="/" className="ask-medium flex min-h-11 w-fit items-center gap-2 text-[14px] text-[#0f62fe] hover:text-[#0043ce] underline"><span className="text-[16px]">←</span> Back</Link>
        <section className="space-y-3">
          <div className="flex items-start gap-3">
            <Avatar />
            <div className="min-w-0 space-y-1.5">
              <h2 className="ask-semibold text-[15px] text-[#161616]">Welcome to your admin assistant</h2>
              <p className="text-[13px] leading-[1.5] text-[#525252]">Ask operational questions, review summaries, check statuses, retrieve data, and launch follow-up actions across {SITE.name}.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {prompts.map(prompt => <button key={prompt} onClick={() => ask(prompt)} className="ask-medium min-h-11 rounded-[2px] border border-[#e0e0e0] bg-white px-3 py-2 text-left text-[12px] text-[#525252] hover:bg-[#e0e0e0] hover:text-[#161616] transition-colors cursor-pointer">{prompt}</button>)}
          </div>
        </section>
        <section className="flex items-start gap-3">
          <Avatar />
          <div className="min-w-0 flex-1 space-y-4">
            <article className="rounded-[2px] border border-[#e0e0e0] bg-white">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e0e0e0] p-4 md:p-5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-[2px] bg-[#edf5ff]"><img alt="" src={`${assets}/62ebc.svg`} /></span>
                  <div><h2 className="ask-semibold text-[15px] text-[#161616]">Today’s operational summary</h2><p className="text-[13px] text-[#525252]">{SITE.name}{live && <> · <span className="font-mono">{simDateTime(live.sim_time)} IST</span></>}</p></div>
                </div>
                <span className="ask-semibold rounded-[2px] bg-[#edf5ff] border border-[#a6c8ff]/60 px-2 py-1 text-[11px] font-mono text-[#0f62fe]">{bobActive ? 'BOB active' : 'BOB paused'}</span>
              </header>
              <div className="space-y-4 p-4 md:p-5">
                <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {[
                    ['Current generation', mw(live?.generation?.actual_mw ?? 0)],
                    ['Forecast', live?.generation?.forecast_mw != null ? mw(live.generation.forecast_mw) : '—'],
                    ['Battery SOC', battery ? `${battery.soc_pct}%` : '—'],
                    ['Grid import', mw(Math.max(live?.grid_mw ?? 0, 0))],
                  ].map(([label, value]) => <div key={label} className="min-w-0 rounded-[2px] border border-[#e0e0e0] bg-[#f4f4f4] p-3"><dt className="text-[12px] text-[#525252]">{label}</dt><dd className="ask-semibold mt-1 text-[15px] font-mono text-[#161616]">{value}</dd></div>)}
                </dl>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-[2px] border border-[#e0e0e0] p-3"><h3 className="ask-semibold text-[13px] uppercase tracking-wide text-[#161616]">Pending approvals</h3><p className="mt-2 text-[13px] leading-[1.5] text-[#525252]">{approvals.length ? `${approvals.length} action${approvals.length > 1 ? 's are' : ' is'} waiting for your decision.` : 'Nothing is waiting for approval at this site.'}</p></div>
                  <div className="rounded-[2px] border border-[#e0e0e0] p-3"><h3 className="ask-semibold text-[13px] uppercase tracking-wide text-[#161616]">What BOB is doing</h3><p className="mt-2 text-[13px] leading-[1.5] text-[#525252]">{live?.bob_now.length ? live.bob_now.join('; ') : 'Nothing at this site in this block.'}</p></div>
                </div>
                {battery && <p className="text-[13px] text-[#525252]">{battery.name}: {batteryState(battery.mw, battery.available)}.</p>}
                <div className="flex flex-wrap gap-3">
                  <Link to={approvals.length ? '/approval' : '/bob'} className="ask-semibold min-h-11 rounded-[2px] bg-[#0f62fe] px-5 py-3 text-[13px] text-white hover:bg-[#0043ce] transition-colors">Open pending approvals</Link>
                  <Link to="/bob" className="ask-semibold min-h-11 rounded-[2px] border border-[#0f62fe] bg-white px-5 py-3 text-[13px] text-[#0f62fe] hover:bg-[#edf5ff] transition-colors">Review configured actions</Link>
                  <button onClick={() => input.current?.focus()} className="ask-semibold min-h-11 rounded-[2px] border border-[#e0e0e0] bg-white px-5 py-3 text-[13px] text-[#161616] hover:bg-[#f4f4f4] transition-colors cursor-pointer">Ask another question</button>
                </div>
              </div>
            </article>
            <article className="rounded-[2px] border border-[#e0e0e0] bg-white">
              <header className="flex items-center justify-between gap-3 border-b border-[#e0e0e0] p-4 md:p-5"><h2 className="ask-semibold text-[15px] text-[#161616]">Recommended follow-up actions</h2><span className="text-[13px] font-mono text-[#525252]">{followUps.length} items</span></header>
              <ol className="space-y-3 p-4 md:p-5">{followUps.map((item, index) => <li key={item.title} className="flex items-center gap-3"><span className="ask-semibold flex size-7 shrink-0 items-center justify-center rounded-[2px] bg-[#edf5ff] text-[12px] font-mono text-[#0f62fe]">{index + 1}</span><div className="min-w-0 flex-1"><h3 className="ask-semibold text-[13px] text-[#161616]">{item.title}</h3><p className="text-[13px] text-[#525252]">{item.detail}</p></div><Link to={item.to} className="ask-medium flex min-h-11 items-center rounded-[2px] border border-[#e0e0e0] bg-[#f4f4f4] px-3 text-[13px] text-[#161616] hover:bg-[#e0e0e0] transition-colors">{item.action}</Link></li>)}</ol>
            </article>
            <nav aria-label="Operational evidence" className="flex flex-wrap gap-4 text-[13px] text-[#0f62fe]"><Link to="/actionDetails" className="hover:text-[#0043ce] underline">View action details</Link><Link to="/workOrder" className="hover:text-[#0043ce] underline">Open maintenance</Link></nav>
          </div>
        </section>
        <section className="flex items-start gap-3"><Avatar /><div className="space-y-1.5"><h2 className="ask-semibold text-[15px] text-[#161616]">Need more detail?</h2><p className="text-[13px] leading-[1.5] text-[#525252]">You can ask for specific data, such as “show battery history”, “list configured actions”, or “what is the current grid price?”.</p></div></section>
        <BobMessages chat={chat} variant="admin" />
      </BobChatScrollArea>
      <footer className="shrink-0 bg-[#f4f4f4] px-4 pb-4 pt-2 md:px-6 md:pb-6">
        <form onSubmit={event => { event.preventDefault(); if (draft.trim() && !chat.pending && !chat.error) ask(draft); }} className="flex min-h-14 items-center gap-2 rounded-[2px] border border-[#e0e0e0] bg-white px-3">
          <textarea ref={input} aria-label="Message BOB" rows={1} value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder="Ask about generation, storage, approvals, or follow-up actions..." className="min-h-11 min-w-0 flex-1 resize-none bg-transparent py-3 text-[14px] placeholder:text-[#8d8d8d] text-[#161616] focus:outline-none" />
          <div className="hidden items-center gap-2 xl:flex">{prompts.slice(0, 3).map(prompt => <button type="button" key={prompt} onClick={() => ask(prompt)} className="ask-medium min-h-11 rounded-[2px] border border-[#e0e0e0] bg-[#f4f4f4] px-2 text-[11px] text-[#525252] hover:bg-[#e0e0e0] hover:text-[#161616] transition-colors">{prompt}</button>)}</div>
          <Link aria-label="Connect a data source or upload CSV" title="Connect a data source or upload CSV" to="/connectData" className="flex size-11 shrink-0 items-center justify-center"><img alt="" src={`${assets}/f0842.svg`} /></Link>
          <button type="submit" aria-label="Send message" disabled={!draft.trim() || chat.pending || Boolean(chat.error)} className="flex size-11 shrink-0 items-center justify-center rounded-[2px] bg-[#0f62fe] hover:bg-[#0043ce] transition-colors disabled:opacity-50 cursor-pointer"><img alt="" src={`${assets}/536bf.svg`} /></button>
        </form>
        <p className="mt-2 text-[11px] text-[#525252]">Chat cannot execute or approve actions. Shift + Enter for a new line.</p>
      </footer>
    </main>
  );
}
