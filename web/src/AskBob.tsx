import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { BobChatScrollArea, BobMessages, BobNewChat, useBobChat } from './BobChat';
import { useOperations } from './Operations';

const assets = '/assets/ask-bob';
const prompts = ['What is the current generation?', 'Show pending approvals', 'What is the battery state?', 'Summarize today’s operations', 'Open configured actions'];

function Avatar() {
  return <span className="flex size-7 shrink-0 items-center justify-center rounded-[2px] bg-[#0f62fe]"><img alt="" src={`${assets}/0d037.svg`} /></span>;
}

export default function AskBob() {
  const operations = useOperations();
  const { state, flow } = operations;
  const navigate = useNavigate();
  const [draft, setDraft] = useState('');
  const input = useRef<HTMLTextAreaElement>(null);
  const chat = useBobChat('monitoring');
  const pending = state.approval?.decision === 'pending';
  const systemStatus = state.gridTelemetryAgeSeconds !== null && state.gridTelemetryAgeSeconds > 120 ? 'Telemetry delayed' : 'AI API connected · Preview telemetry';
  const balance = flow.solar + flow.battery + flow.grid;
  const ask = (text: string) => {
    if (text === 'Open configured actions') { navigate('/bob'); return; }
    if (chat.pending || chat.error) { setDraft(text); input.current?.focus(); return; }
    void chat.send(text);
    setDraft('');
  };
  const followUps = [
    { title: pending ? 'Review the pending grid import' : state.approval ? `Review the ${state.approval.decision} grid import` : 'Review the grid import forecast', detail: pending ? `${state.approval?.mw} MW import for 15 minutes is waiting for approval.` : state.approval ? `Actual grid import: ${flow.grid} MW. ${flow.deficit} MW deficit remains.` : 'At 14:50, 52 MW demand would leave an 8 MW deficit. No approval request is pending.', to: state.approval ? '/approval' : '/actionDetails?evidence=gridForecast', action: 'Open' },
    { title: 'Validate the evening demand forecast', detail: 'Review the demand forecast and its evidence before taking additional action.', to: '/liveOverview', action: 'Review' },
    { title: 'Confirm the market connection', detail: 'The electricity market connection is still required for the sell surplus action.', to: '/connectData', action: 'Connect' },
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
        <Link to={state.activated ? '/monitoring' : '/'} className="ask-medium flex min-h-11 w-fit items-center gap-2 text-[14px] text-[#0f62fe] hover:text-[#0043ce] underline"><span className="text-[16px]">←</span> Back</Link>
        <section className="space-y-3">
          <div className="flex items-start gap-3">
            <Avatar />
            <div className="min-w-0 space-y-1.5">
              <h2 className="ask-semibold text-[15px] text-[#161616]">Welcome to your admin assistant</h2>
              <p className="text-[13px] leading-[1.5] text-[#525252]">Ask operational questions, review summaries, check statuses, retrieve data, and launch follow-up actions across the Kuppam Solar Site.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {prompts.map(prompt => <button key={prompt} onClick={() => ask(prompt)} className="ask-medium min-h-11 rounded-[2px] border border-[#e0e0e0] bg-white px-3 py-2 text-left text-[12px] text-[#525252] hover:bg-[#e0e0e0] hover:text-[#161616] transition-colors cursor-pointer">{prompt}</button>)}
          </div>
        </section>
        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-[2px] bg-[#e0e0e0] px-4 py-3 md:max-w-[70%] border border-[#e0e0e0]">
            <p className="ask-medium text-[14px] text-[#161616]">Summarize today’s operations, pending approvals, and any follow-up actions I should review.</p>
            <p className="mt-1 text-[11px] text-[#525252]">Preview question · Operational summary below uses the shared site state</p>
          </div>
        </div>
        <section className="flex items-start gap-3">
          <Avatar />
          <div className="min-w-0 flex-1 space-y-4">
            <p className="text-[14px] text-[#161616]">Here is the operational overview you requested. I have grouped the information into generation, storage, approvals, and follow-up actions so you can review the site quickly.</p>
            <article className="rounded-[2px] border border-[#e0e0e0] bg-white">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e0e0e0] p-4 md:p-5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-[2px] bg-[#edf5ff]"><img alt="" src={`${assets}/62ebc.svg`} /></span>
                  <div><h2 className="ask-semibold text-[15px] text-[#161616]">Today’s operational summary</h2><p className="text-[13px] text-[#525252]">Kuppam Solar Site · <span className="font-mono">{flow.timestamp}</span></p></div>
                </div>
                <span className="ask-semibold rounded-[2px] bg-[#edf5ff] border border-[#a6c8ff]/60 px-2 py-1 text-[11px] font-mono text-[#0f62fe]">{state.stage} · Preview</span>
              </header>
              <div className="space-y-4 p-4 md:p-5">
                <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {[
                    ['Current generation', `${flow.solar} MW`],
                    ['Forecast vs actual', `${((flow.solar - 45) / 45 * 100).toFixed(1)}%`],
                    ['Battery SOC', `${flow.soc}%`],
                    ['Grid reliability', '97%'],
                  ].map(([label, value]) => <div key={label} className="min-w-0 rounded-[2px] border border-[#e0e0e0] bg-[#f4f4f4] p-3"><dt className="text-[12px] text-[#525252]">{label}</dt><dd className="ask-semibold mt-1 text-[15px] font-mono text-[#161616]">{value}</dd></div>)}
                </dl>
                <p className="text-[11px] text-[#8d8d8d]">Forecast: 45 MW reference preview. Grid reliability: design reference, not a live measurement.</p>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-[2px] border border-[#e0e0e0] p-3"><h3 className="ask-semibold text-[13px] uppercase tracking-wide text-[#161616]">Pending approvals</h3><p className="mt-2 text-[13px] leading-[1.5] text-[#525252]">{pending ? `1 grid import action is waiting for your review. The current proposal is to import ${state.approval?.mw} MW for 15 minutes.` : state.approval ? `No pending approvals. Grid import request ${state.approval.decision}; actual import ${flow.grid} MW.` : 'No grid import action is waiting for approval. The 14:50 recommendation remains a forecast until requested.'}</p></div>
                  <div className="rounded-[2px] border border-[#e0e0e0] p-3"><h3 className="ask-semibold text-[13px] uppercase tracking-wide text-[#161616]">Follow-up actions</h3><p className="mt-2 text-[13px] leading-[1.5] text-[#525252]">Review the battery charge rule, confirm the market connection, and validate the evening demand forecast.</p></div>
                </div>
                <p className={`text-[13px] ${flow.deficit ? 'text-[#da1e28]' : 'text-[#525252]'}`}>Solar <span className="font-mono">{flow.solar} MW</span> + Battery <span className="font-mono">{flow.battery} MW</span> + Grid <span className="font-mono">{flow.grid} MW</span> = <span className="font-mono">{balance} MW</span> supply / <span className="font-mono">{flow.demand} MW</span> demand. {flow.deficit ? `${flow.deficit} MW deficit remains uncovered.` : 'Supply is balanced.'}</p>
                <div className="flex flex-wrap gap-3">
                  <Link to={pending ? '/approval' : '/bob'} className="ask-semibold min-h-11 rounded-[2px] bg-[#0f62fe] px-5 py-3 text-[13px] text-white hover:bg-[#0043ce] transition-colors">Open pending approvals</Link>
                  <Link to="/bob" className="ask-semibold min-h-11 rounded-[2px] border border-[#0f62fe] bg-white px-5 py-3 text-[13px] text-[#0f62fe] hover:bg-[#edf5ff] transition-colors">Review configured actions</Link>
                  <button onClick={() => input.current?.focus()} className="ask-semibold min-h-11 rounded-[2px] border border-[#e0e0e0] bg-white px-5 py-3 text-[13px] text-[#161616] hover:bg-[#f4f4f4] transition-colors cursor-pointer">Ask another question</button>
                </div>
              </div>
            </article>
            <article className="rounded-[2px] border border-[#e0e0e0] bg-white">
              <header className="flex items-center justify-between gap-3 border-b border-[#e0e0e0] p-4 md:p-5"><h2 className="ask-semibold text-[15px] text-[#161616]">Recommended follow-up actions</h2><span className="text-[13px] font-mono text-[#525252]">{followUps.length} items</span></header>
              <ol className="space-y-3 p-4 md:p-5">{followUps.map((item, index) => <li key={item.title} className="flex items-center gap-3"><span className="ask-semibold flex size-7 shrink-0 items-center justify-center rounded-[2px] bg-[#edf5ff] text-[12px] font-mono text-[#0f62fe]">{index + 1}</span><div className="min-w-0 flex-1"><h3 className="ask-semibold text-[13px] text-[#161616]">{item.title}</h3><p className="text-[13px] text-[#525252]">{item.detail}</p></div><Link to={item.to} className="ask-medium flex min-h-11 items-center rounded-[2px] border border-[#e0e0e0] bg-[#f4f4f4] px-3 text-[13px] text-[#161616] hover:bg-[#e0e0e0] transition-colors">{item.action}</Link></li>)}</ol>
            </article>
            <nav aria-label="Operational evidence" className="flex flex-wrap gap-4 text-[13px] text-[#0f62fe]"><Link to="/actionDetails" className="hover:text-[#0043ce] underline">View action details</Link><Link to="/workOrder" className="hover:text-[#0043ce] underline">Open work order</Link></nav>
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
