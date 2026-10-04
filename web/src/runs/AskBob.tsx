import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, IconButton, InlineLoading, InlineNotification, Tag, TextArea, Tile } from '@carbon/react'
import { Close, Locked, Send } from '@carbon/icons-react'
import { runApi, type ChatCard, type WhatIfPlan } from '../api/client'
import { AUTONOMY, configKindLabel, limitsSummary, mwh, netCost } from '../format'
import { useCurrentRun } from './useCurrentRun'

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
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history.data, send.isPending, live])

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
        {send.error && <InlineNotification kind="error" lowContrast hideCloseButton title={send.error.message} />}
        <div ref={end} />
      </div>
      {!run.bob_online && <p className="stat-label">BOB is offline; decisions continue on rules.</p>}
      <div className="chat__input">
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

/** BOB writes plain prose but may bold a figure with **…**. */
const withBold = (text: string) =>
  text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part))

/** `last` carries the wizard link, so a draft followed by its tests links once. */
function CardView({ card, last }: { card: ChatCard; last: boolean }) {
  if (card.type === 'blocked') {
    return (
      <Tile className="chat-card chat-card--blocked">
        <div className="card-title"><Locked /> Safety rule blocked this setting</div>
        <p>{configKindLabel(card.kind)} on {card.asset_name}: {card.text}</p>
      </Tile>
    )
  }
  if (card.type === 'what_if') {
    const rows: Array<[string, (p: WhatIfPlan) => string]> = [
      ['Net cost (24 h)', (p) => netCost(p.net_cost_inr ?? 0)],
      ['Carbon', (p) => `${p.carbon_t} t`],
      ['Curtailed', (p) => mwh(p.curtailed_mwh ?? 0)],
      ['Unserved', (p) => mwh(p.unserved_mwh ?? 0)],
    ]
    return (
      <Tile className="chat-card">
        <div className="card-title">What-if, not executed</div>
        <table className="chat-card__table">
          <thead><tr><th /><th>Now</th><th>What-if</th></tr></thead>
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label}>
                <td>{label}</td>
                {[card.current, card.what_if].map((p, i) => <td key={i}>{p.feasible ? value(p) : 'No feasible plan'}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
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
