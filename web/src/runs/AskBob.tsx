import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button, IconButton, InlineLoading, InlineNotification, OverflowMenu, OverflowMenuItem, TextArea,
} from '@carbon/react'
import { Attachment, Bot, Close, Locked, Send } from '@carbon/icons-react'
import { documentApi, fileUpload, runApi, type ChatCard } from '../api/client'
import { AUTONOMY, configKindLabel, limitsSummary } from '../format'
import { useCurrentRun } from './useCurrentRun'
import { WhatIfTable } from './WhatIfTable'

const SUGGESTIONS = [
  { label: 'What needs my attention?', question: 'What is happening right now, and what needs my attention?' },
  { label: 'Why this plan?', question: 'Why did you choose the plan for the latest block?' },
  { label: 'What if a battery trips?', question: 'What if the largest battery trips and demand rises 10 %?' },
  { label: 'Remove a battery reserve', question: 'Remove the minimum battery reserve on Battery 1.' },
]

const AskBobContext = createContext<(question?: string) => void>(() => {})

/** Opens the Ask BOB drawer, optionally with a question ready to send. */
export const useAskBob = () => useContext(AskBobContext)

export function AskBobProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<{ question?: string; n: number } | null>(null)
  return (
    <AskBobContext.Provider value={(question) => setOpen((o) => ({ question, n: (o?.n ?? 0) + 1 }))}>
      {children}
      {open && (
        <aside className="ask-bob" aria-label="Ask BOB">
          <div className="ask-bob__head">
            <span className="ask-bob__title"><span className="icon-box icon-box--brand"><Bot size={16} /></span>Ask BOB</span>
            <IconButton label="Close" kind="ghost" size="sm" onClick={() => setOpen(null)}>
              <Close />
            </IconButton>
          </div>
          <Chat key={open.n} question={open.question} />
        </aside>
      )}
    </AskBobContext.Provider>
  )
}

/** What the operator is looking at, so "this battery" means something to BOB. */
function usePageContext(): string | undefined {
  const { pathname, search } = useLocation()
  const params = new URLSearchParams(search)
  const site = pathname.match(/^\/sites\/([^/]+)/)?.[1]
  if (site && pathname.endsWith('/setup') && params.get('asset')) {
    return `setup wizard for ${params.get('asset')}, action ${params.get('kind') ?? 'not chosen'}, site ${site}`
  }
  if (site) return `site ${site}`
  const decision = pathname.match(/^\/decisions\/(\d+)/)?.[1]
  if (decision) return `decision record of cycle ${decision}`
  return undefined
}

export function Chat({ question }: { question?: string }) {
  const { data: run } = useCurrentRun()
  const queryClient = useQueryClient()
  const context = usePageContext()
  const [text, setText] = useState(question ?? '')
  const list = useRef<HTMLDivElement>(null)
  const history = useQuery({ queryKey: ['chat', run?.id], queryFn: () => runApi.chat(run!.id), enabled: !!run })
  // The answer as it streams in; a new status means BOB moved on to a tool, so earlier text was a preamble.
  const [live, setLive] = useState({ status: '', text: '' })
  const send = useMutation({
    mutationFn: async (message: string) => {
      let finished = false
      await runApi.ask(run!.id, message, context, (e) => {
        if (e.event === 'status') setLive({ status: e.data, text: '' })
        else if (e.event === 'delta') setLive((l) => ({ status: '', text: l.text + e.data }))
        else {
          finished = true
          queryClient.setQueryData(['chat', run!.id], e.data)
          queryClient.invalidateQueries({ queryKey: ['configs'] }) // a draft may have changed
        }
      })
      if (!finished) throw new Error('The answer was cut off. Ask again.')
    },
    onMutate: () => { setText(''); setLive({ status: '', text: '' }) }, // the question shows while BOB works
    onError: (_, message) => setText(message),
  })
  const upload = useMutation({
    mutationFn: (doc: { sample: string } | { filename: string; data: string }) => documentApi.upload(run!.id, doc),
    onSuccess: (items) => {
      queryClient.setQueryData(['chat', run!.id], items)
      queryClient.invalidateQueries() // an applied constraint re-plans the block
    },
  })
  // Scroll the message list only: scrollIntoView would also scroll the page that holds the chat.
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' })
  }, [history.data, send.isPending, live, upload.isPending])

  if (!run) return <p className="page-meta">Start a run to talk to BOB.</p>
  const submit = (message: string) => message.trim() && !send.isPending && send.mutate(message.trim())
  const items = history.data ?? []

  return (
    <div className="chat">
      <div className="chat__messages" ref={list}>
        {items.length === 0 && !send.isPending && (
          <div className="chat__welcome">
            <div className="chat__bot">
              <span className="icon-box icon-box--brand"><Bot size={16} /></span>
              <div>
                <strong>Welcome to Ask BOB</strong>
                <p>BOB answers from the live decision records: decisions, assets, approvals, what-if plans and action setups.</p>
              </div>
            </div>
            <div className="chat__chips">
              {SUGGESTIONS.map((s) => (
                <button key={s.label} type="button" onClick={() => submit(s.question)}>{s.label}</button>
              ))}
            </div>
          </div>
        )}
        {items.map((m) => <Message key={m.id} role={m.role} text={m.text}>
          {m.cards.map((c, i) => <CardView key={i} card={c} last={i === m.cards.length - 1} />)}
        </Message>)}
        {send.isPending && (
          <>
            <Message role="user" text={send.variables} />
            {live.text ? <Message role="assistant" text={live.text} /> : <InlineLoading description={`${live.status || 'BOB is thinking'}…`} />}
          </>
        )}
        {upload.isPending && (
          <InlineLoading description={`BOB is reading ${'sample' in upload.variables ? upload.variables.sample
            : upload.variables.filename}…`} />
        )}
        {(send.error ?? upload.error) && (
          <InlineNotification kind="error" lowContrast hideCloseButton title={(send.error ?? upload.error)!.message} />
        )}
      </div>
      <div className="composer">
        <TextArea labelText="Message" hideLabel rows={1} value={text}
          placeholder="Ask about decisions, assets, approvals or what-if plans…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(text) } }} />
        <div className="composer__chips">
          {SUGGESTIONS.slice(0, 3).map((s) => (
            <button key={s.label} type="button" onClick={() => submit(s.question)}>{s.label}</button>
          ))}
        </div>
        <Attach disabled={upload.isPending} onPick={(doc) => upload.mutate(doc)} />
        <IconButton label="Send" className="composer__send" disabled={!text.trim() || send.isPending} onClick={() => submit(text)}>
          <Send />
        </IconButton>
      </div>
      <p className="chat__note">
        {run.bob_online ? 'BOB never executes or approves actions from chat.' : 'BOB is offline; decisions continue on rules.'}{' '}
        Shift + Enter for a new line.
      </p>
    </div>
  )
}

function Message({ role, text, children }: { role: string; text: string; children?: ReactNode }) {
  if (role === 'user') return <div className="chat__user">{text}</div>
  return (
    <div className="chat__bot">
      <span className="icon-box icon-box--brand"><Bot size={16} /></span>
      <div className="chat__answer">
        {text && <p>{withBold(text)}</p>}
        {children}
      </div>
    </div>
  )
}

/** 📎: a file from disk, or one of the simulated samples. */
function Attach({ disabled, onPick }: {
  disabled: boolean
  onPick: (doc: { sample: string } | { filename: string; data: string }) => void
}) {
  const samples = useQuery({ queryKey: ['document-samples'], queryFn: documentApi.samples, staleTime: Infinity })
  const file = useRef<HTMLInputElement>(null)
  return (
    <>
      <input ref={file} type="file" hidden accept=".pdf,.txt,.png,.jpg,.jpeg"
        onChange={(e) => { if (e.target.files?.[0]) fileUpload(e.target.files[0]).then(onPick); e.target.value = '' }} />
      <OverflowMenu renderIcon={Attachment} iconDescription="Attach a document" disabled={disabled} flipped
        direction="top" aria-label="Attach a document">
        <OverflowMenuItem itemText="Upload a file…" onClick={() => file.current?.click()} />
        {samples.data?.map((s) => (
          <OverflowMenuItem key={s.name} itemText={`Sample: ${s.title}`} onClick={() => onPick({ sample: s.name })} />
        ))}
      </OverflowMenu>
    </>
  )
}

/** BOB writes plain prose but may bold a figure with **…**. */
const withBold = (text: string) =>
  text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part))

/** `last` carries the wizard link, so a draft followed by its tests links once. */
function CardView({ card, last }: { card: ChatCard; last: boolean }) {
  if (card.type === 'constraint') return <ConstraintCard card={card} />
  if (card.type === 'blocked') {
    return (
      <div className="panel chat-card chat-card--blocked">
        <div className="chat-card__head"><strong><Locked /> Safety rule blocked this setting</strong></div>
        <p>{configKindLabel(card.kind)} on {card.asset_name}: {card.text}</p>
      </div>
    )
  }
  if (card.type === 'what_if') {
    return (
      <div className="panel chat-card">
        <div className="chat-card__head"><strong>What-if</strong><span className="badge badge--gray">Not executed</span></div>
        <WhatIfTable current={card.current} whatIf={card.what_if} />
        <p className="cell-sub">What-if actions: {card.what_if.actions?.join('; ') ?? '—'}</p>
      </div>
    )
  }

  const link = `/sites/${card.site}/bob/setup?asset=${card.asset}&kind=${card.kind}&draft=${card.config_id}`
  return (
    <div className="panel chat-card">
      {card.type === 'draft' ? (
        <>
          <div className="chat-card__head">
            <strong>{configKindLabel(card.kind)} · {card.asset_name}</strong><span className="badge badge--blue">Draft v{card.version}</span>
          </div>
          <p>{AUTONOMY[card.autonomy].label}. {limitsSummary(card.limits).join('; ')}</p>
        </>
      ) : (
        <>
          <div className="chat-card__head"><strong>Tests: {configKindLabel(card.kind)} · {card.asset_name}</strong></div>
          {Object.entries(card.tests).map(([key, t]) => (
            <div key={key} className="kv-line">
              <span>{t.label}</span>
              <span className={`badge badge--${t.passed ? 'green' : 'red'}`}>{t.passed ? 'Passed' : 'Failed'}</span>
            </div>
          ))}
        </>
      )}
      {last && <Link className="text-link" to={link}>Review and activate in setup</Link>}
    </div>
  )
}

const CONSTRAINT_STATUS = {
  active: { tone: 'green', label: 'Applied' },
  pending: { tone: 'amber', label: 'Needs your confirmation' },
  rejected: { tone: 'red', label: 'Not applied' },
  withdrawn: { tone: 'gray', label: 'Withdrawn' },
} as const

/** A constraint read from a document, with its quote and what a person can still do. */
function ConstraintCard({ card }: { card: Extract<ChatCard, { type: 'constraint' }> }) {
  const { data: run } = useCurrentRun()
  const queryClient = useQueryClient()
  const decide = useMutation({
    mutationFn: (decision: 'apply' | 'reject' | 'withdraw') => documentApi.decide(run!.id, card.id, decision),
    onSuccess: (items) => {
      queryClient.setQueryData(['chat', run!.id], items)
      queryClient.invalidateQueries()
    },
  })
  const status = CONSTRAINT_STATUS[card.status]
  return (
    <div className="panel chat-card">
      <div className="chat-card__head">
        <strong>{card.label}</strong>
        <span className={`badge badge--${status.tone}`}>{status.label}</span>
      </div>
      <blockquote className="chat-card__quote">“{card.quote}”</blockquote>
      <p className="cell-sub">
        {card.note}. {card.filename && `From ${card.filename}; `}confidence {Math.round(card.confidence * 100)} %
        {card.verified ? ', quote found in the document' : ''}.
      </p>
      {decide.error && <InlineNotification kind="error" lowContrast hideCloseButton title={decide.error.message} />}
      {card.status === 'pending' && (
        <div className="chat-card__foot">
          <Button kind="tertiary" size="sm" disabled={decide.isPending} onClick={() => decide.mutate('reject')}>Reject</Button>
          <Button size="sm" disabled={decide.isPending} onClick={() => decide.mutate('apply')}>Apply</Button>
        </div>
      )}
      {card.status === 'active' && (
        <div className="chat-card__foot">
          <Button kind="ghost" size="sm" disabled={decide.isPending} onClick={() => decide.mutate('withdraw')}>
            Withdraw
          </Button>
        </div>
      )}
    </div>
  )
}
