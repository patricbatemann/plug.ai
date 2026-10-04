import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button, IconButton, InlineLoading, InlineNotification, OverflowMenu, OverflowMenuItem, Tag, TextArea, Tile,
} from '@carbon/react'
import { Attachment, Close, Locked, Send } from '@carbon/icons-react'
import { documentApi, runApi, type ChatCard } from '../api/client'
import { AUTONOMY, configKindLabel, limitsSummary } from '../format'
import { useCurrentRun } from './useCurrentRun'
import { WhatIfTable } from './WhatIfTable'

const SUGGESTIONS = [
  'What is happening right now, and what needs my attention?',
  'Why did you choose the plan for the latest block?',
  'What if the largest battery trips and demand rises 10 %?',
  'Remove the minimum battery reserve on Battery 1.',
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
            <span className="card-title">Ask BOB</span>
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
  const end = useRef<HTMLDivElement>(null)
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
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history.data, send.isPending, live, upload.isPending])

  if (!run) return <p className="page-meta">Start a run to talk to BOB.</p>
  const submit = (message: string) => message.trim() && !send.isPending && send.mutate(message.trim())
  const items = history.data ?? []

  return (
    <div className="chat">
      <div className="chat__messages">
        {items.length === 0 && !send.isPending && (
          <div className="chat__suggestions">
            <p className="stat-label">BOB answers from the live decision records. Try:</p>
            {SUGGESTIONS.map((s) => (
              <Button key={s} kind="ghost" size="sm" onClick={() => submit(s)}>{s}</Button>
            ))}
          </div>
        )}
        {items.map((m) => (
          <div key={m.id} className={`chat__message chat__message--${m.role}`}>
            {m.text && <p>{withBold(m.text)}</p>}
            {m.cards.map((c, i) => <CardView key={i} card={c} last={i === m.cards.length - 1} />)}
          </div>
        ))}
        {send.isPending && (
          <>
            <div className="chat__message chat__message--user"><p>{send.variables}</p></div>
            {live.text ? (
              <div className="chat__message chat__message--assistant"><p>{withBold(live.text)}</p></div>
            ) : (
              <InlineLoading description={`${live.status || 'BOB is thinking'}…`} />
            )}
          </>
        )}
        {upload.isPending && (
          <InlineLoading description={`BOB is reading ${'sample' in upload.variables ? upload.variables.sample
            : upload.variables.filename}…`} />
        )}
        {(send.error ?? upload.error) && (
          <InlineNotification kind="error" lowContrast hideCloseButton title={(send.error ?? upload.error)!.message} />
        )}
        <div ref={end} />
      </div>
      {!run.bob_online && <p className="stat-label">BOB is offline; decisions continue on rules.</p>}
      <div className="chat__input">
        <Attach disabled={upload.isPending} onPick={(doc) => upload.mutate(doc)} />
        <TextArea labelText="Message" hideLabel rows={2} value={text} placeholder="Ask BOB…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(text) } }} />
        <IconButton label="Send" disabled={!text.trim() || send.isPending} onClick={() => submit(text)}>
          <Send />
        </IconButton>
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
  const read = (f: File) => {
    const reader = new FileReader()
    reader.onload = () => onPick({ filename: f.name, data: String(reader.result).split(',')[1] })
    reader.readAsDataURL(f)
  }
  return (
    <>
      <input ref={file} type="file" hidden accept=".pdf,.txt,.png,.jpg,.jpeg"
        onChange={(e) => { if (e.target.files?.[0]) read(e.target.files[0]); e.target.value = '' }} />
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
      <Tile className="chat-card chat-card--blocked">
        <div className="card-title"><Locked /> Safety rule blocked this setting</div>
        <p>{configKindLabel(card.kind)} on {card.asset_name}: {card.text}</p>
      </Tile>
    )
  }
  if (card.type === 'what_if') {
    return (
      <Tile className="chat-card">
        <div className="card-title">What-if, not executed</div>
        <WhatIfTable current={card.current} whatIf={card.what_if} />
        <p className="stat-label">What-if actions: {card.what_if.actions?.join('; ') ?? '—'}</p>
      </Tile>
    )
  }

  const link = `/sites/${card.site}/bob/setup?asset=${card.asset}&kind=${card.kind}&draft=${card.config_id}`
  return (
    <Tile className="chat-card">
      {card.type === 'draft' ? (
        <>
          <div className="card-title">Draft v{card.version}: {configKindLabel(card.kind)} · {card.asset_name}</div>
          <p>{AUTONOMY[card.autonomy].label}. {limitsSummary(card.limits).join('; ')}</p>
        </>
      ) : (
        <>
          <div className="card-title">Tests: {configKindLabel(card.kind)} · {card.asset_name}</div>
          {Object.entries(card.tests).map(([key, t]) => (
            <div key={key} className="action-card__head">
              <Tag size="sm" type={t.passed ? 'green' : 'red'}>{t.passed ? 'Passed' : 'Failed'}</Tag> {t.label}
            </div>
          ))}
        </>
      )}
      {last && <Link className="cds--link" to={link}>Review and activate in setup</Link>}
    </Tile>
  )
}

const CONSTRAINT_STATUS = {
  active: { tag: 'green', label: 'Applied' },
  pending: { tag: 'warm-gray', label: 'Needs your confirmation' },
  rejected: { tag: 'red', label: 'Not applied' },
  withdrawn: { tag: 'gray', label: 'Withdrawn' },
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
    <Tile className="chat-card">
      <div className="action-card__head">
        <span className="card-title">{card.label}</span>
        <Tag size="sm" type={status.tag}>{status.label}</Tag>
      </div>
      <blockquote className="chat-card__quote">“{card.quote}”</blockquote>
      <p className="stat-label">
        {card.note}. {card.filename && `From ${card.filename}; `}confidence {Math.round(card.confidence * 100)} %
        {card.verified ? ', quote found in the document' : ''}.
      </p>
      {decide.error && <InlineNotification kind="error" lowContrast hideCloseButton title={decide.error.message} />}
      {card.status === 'pending' && (
        <div className="action-card__foot">
          <Button kind="tertiary" size="sm" disabled={decide.isPending} onClick={() => decide.mutate('reject')}>Reject</Button>
          <Button size="sm" disabled={decide.isPending} onClick={() => decide.mutate('apply')}>Apply</Button>
        </div>
      )}
      {card.status === 'active' && (
        <div className="action-card__foot">
          <Button kind="ghost" size="sm" disabled={decide.isPending} onClick={() => decide.mutate('withdraw')}>
            Withdraw
          </Button>
        </div>
      )}
    </Tile>
  )
}
