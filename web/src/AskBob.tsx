import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { BobChatScrollArea, BobMessages, BobNewChat, useBobChat } from './BobChat';
import { useSite } from './site';

const assets = '/assets/ask-bob';

export default function AskBob() {
  const { live, siteName } = useSite();
  const [draft, setDraft] = useState('');
  const input = useRef<HTMLTextAreaElement>(null);
  const chat = useBobChat('the whole portfolio, Ask BOB screen');
  const systemStatus = live?.connected ? 'Live telemetry' : 'Telemetry not connected';
  const ask = (text: string) => {
    void chat.send(text);
    setDraft('');
  };

  return (
    <main className="ask-bob flex h-full min-h-0 flex-col bg-[#f4f4f4] text-[#161616] font-sans">
      <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-4 border-b border-[#e0e0e0] bg-white px-4 py-3 md:px-6">
        <span className="flex size-8 items-center justify-center rounded-[2px] bg-[#0f62fe]"><img alt="" src={`${assets}/0b229.svg`} /></span>
        <h1 className="ask-semibold text-[16px] text-[#161616]">BOB Admin Assistant</h1>
        <span className="ask-semibold rounded-[2px] bg-[#edf5ff] border border-[#a6c8ff]/60 px-2 py-1 text-[11px] font-mono text-[#0f62fe]">{systemStatus}</span>
        <span className="ml-auto"><BobNewChat chat={chat} /></span>
      </header>
      <BobChatScrollArea className="flex-1 p-4 md:p-6" updateKey={`${chat.messages.length}:${chat.pending}:${chat.error}`} lastUserId={chat.messages.filter(message => message.role === 'user').at(-1)?.id}>
        {chat.ready && chat.messages.length === 0 && <p className="text-[14px] text-[#525252]">Ask BOB about {siteName}: its generation, battery, approvals or decisions, or ask it to set up an action.</p>}
        <BobMessages chat={chat} variant="admin" />
      </BobChatScrollArea>
      <footer className="shrink-0 bg-[#f4f4f4] px-4 pb-4 pt-2 md:px-6 md:pb-6">
        <form onSubmit={event => { event.preventDefault(); if (draft.trim() && !chat.pending && !chat.error) ask(draft); }} className="flex min-h-14 items-center gap-2 rounded-[2px] border border-[#e0e0e0] bg-white px-3">
          <textarea ref={input} aria-label="Message BOB" rows={1} value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder="Ask about generation, storage, approvals, or follow-up actions..." className="min-h-11 min-w-0 flex-1 resize-none bg-transparent py-3 text-[14px] placeholder:text-[#8d8d8d] text-[#161616] focus:outline-none" />
          <Link aria-label="Connect a data source or upload CSV" title="Connect a data source or upload CSV" to="/connectData" className="flex size-11 shrink-0 items-center justify-center"><img alt="" src={`${assets}/f0842.svg`} /></Link>
          <button type="submit" aria-label="Send message" disabled={!draft.trim() || chat.pending || Boolean(chat.error)} className="flex size-11 shrink-0 items-center justify-center rounded-[2px] bg-[#0f62fe] hover:bg-[#0043ce] transition-colors disabled:opacity-50 cursor-pointer"><img alt="" src={`${assets}/536bf.svg`} /></button>
        </form>
        <p className="mt-2 text-[11px] text-[#525252]">BOB can draft and test actions; a person activates them. Shift + Enter for a new line.</p>
      </footer>
    </main>
  );
}
