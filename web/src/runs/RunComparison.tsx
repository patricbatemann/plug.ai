import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button, SkeletonText } from '@carbon/react'
import { Activity, ArrowDownLeft, ArrowUpRight, BatteryCharging, Bot, Download, Industry, Search, Tools } from '@carbon/icons-react'
import { runApi, type ActionOut, type RunState } from '../api/client'
import { actionLabel, inr, mw, netCost, simTime, statusOf, WORK_ORDERS } from '../format'

const BADGE: Record<string, string> = { green: 'green', blue: 'blue', red: 'red' }

function TypeIcon({ kind }: { kind: string }) {
  if (kind.startsWith('bess')) return <BatteryCharging size={14} />
  if (kind === 'rtm_sell' || kind === 'curtail') return <ArrowUpRight size={14} />
  if (kind === 'rtm_buy') return <ArrowDownLeft size={14} />
  if (WORK_ORDERS.includes(kind)) return <Tools size={14} />
  return <Industry size={14} />
}

const row = (a: ActionOut) => [
  simTime(a.time), a.site ?? 'Portfolio', actionLabel(a.kind, a.mw), a.asset ?? '', Math.abs(a.mw),
  a.delivered_mw === null ? '' : Math.abs(a.delivered_mw), a.decided_by ?? 'BOB', statusOf(a.status).label,
]

function exportCsv(actions: ActionOut[]) {
  const head = ['Time (IST)', 'Site', 'Action', 'Asset', 'Commanded MW', 'Delivered MW', 'Initiated by', 'Status']
  const csv = [head, ...actions.map(row)].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  link.download = 'transactions.csv'
  link.click()
  URL.revokeObjectURL(link.href)
}

/** BOB against today's practice on the same simulated day, and BOB's latest actions. */
export function RunComparison({ run }: { run: RunState }) {
  const summary = useQuery({ queryKey: ['summary', run.id, run.block], queryFn: () => runApi.summary(run.id) })
  const actions = useQuery({ queryKey: ['actions', run.id, run.block], queryFn: () => runApi.actions(run.id) })
  const [search, setSearch] = useState('')
  const [who, setWho] = useState<'all' | 'bob' | 'person'>('all')
  const [status, setStatus] = useState('all')
  if (!summary.data || !actions.data) return <SkeletonText paragraph lineCount={4} />

  const { bob, baseline, saving_inr } = summary.data
  const delta = (ours: number, theirs: number, unit: string) =>
    ({ change: `${ours <= theirs ? '−' : '+'}${Math.abs(ours - theirs).toFixed(1)} ${unit}`, good: ours <= theirs })
  const tiles = [
    { label: 'Net cost', value: netCost(bob.cost_inr), change: `${inr(Math.abs(saving_inr))} ${saving_inr >= 0 ? 'saved' : 'more'}`, good: saving_inr >= 0 },
    { label: 'Curtailment', value: `${bob.curtailed_mwh.toFixed(1)} MWh`, ...delta(bob.curtailed_mwh, baseline.curtailed_mwh, 'MWh') },
    { label: 'Deviation from schedule', value: `${bob.deviation_mwh.toFixed(1)} MWh`, ...delta(bob.deviation_mwh, baseline.deviation_mwh, 'MWh') },
    { label: 'Carbon from imports', value: `${bob.carbon_t.toFixed(1)} t`, ...delta(bob.carbon_t, baseline.carbon_t, 't') },
  ]
  const statuses = [...new Set(actions.data.map((a) => statusOf(a.status).label))]
  const rows = actions.data.filter((a) =>
    (who === 'all' || (who === 'person') === !!a.decided_by) &&
    (status === 'all' || statusOf(a.status).label === status) &&
    row(a).join(' ').toLowerCase().includes(search.toLowerCase()))

  return (
    <section className="panel ledger">
      <div className="ledger__head">
        <div>
          <h2 className="ledger__title">Transaction history</h2>
          <p className="rec__text">BOB's actions today, and what they changed against today's practice on the same day.</p>
        </div>
        <Button className="btn-tall" onClick={() => exportCsv(rows)}>
          <Download size={16} className="btn-lead-icon" />Export CSV
        </Button>
      </div>

      <div className="ledger__tiles">
        {tiles.map((t) => (
          <div key={t.label} className="tile-stat">
            <div className="tile-stat__head">
              <span className="caps-label caps-label--strong">{t.label}</span>
              <span className="icon-box"><Activity size={16} className="icon-success" /></span>
            </div>
            <div className="tile-stat__value">{t.value}</div>
            <div className="tile-stat__change">
              <span className={t.good ? 'text-success' : 'text-error'}>{t.change}</span> vs today's practice
            </div>
          </div>
        ))}
      </div>

      <div className="ledger__filters">
        <label className="field field--well">
          <Search size={16} />
          <input aria-label="Search transactions" placeholder="Search actions…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <div className="segmented" role="group" aria-label="Initiated by">
          {(['all', 'bob', 'person'] as const).map((w) => (
            <button key={w} type="button" aria-pressed={who === w} onClick={() => setWho(w)}>
              {w === 'all' ? 'All' : w === 'bob' ? 'BOB agent' : 'Decided by a person'}
            </button>
          ))}
        </div>
        <label className="field field--line ledger__status">
          <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All statuses</option>
            {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>

      <div className="ledger__scroll" role="region" aria-label="Transaction history table" tabIndex={0}>
        <div className="ledger__row ledger__row--head">
          <div>Time</div><div>Site</div><div>Type</div><div>Initiated by</div>
          <div>Commanded</div><div>Delivered</div><div>Status</div><div>Action</div>
        </div>
        {rows.map((a) => (
          <div key={a.id} className="ledger__row">
            <div>{simTime(a.time)}</div>
            <div className="ledger__site">{a.site ?? 'Portfolio'}</div>
            <div>
              <div className="cell-icon"><TypeIcon kind={a.kind} />{actionLabel(a.kind, a.mw)}</div>
              {a.asset && <div className="cell-sub">{a.asset}</div>}
            </div>
            <div className="cell-icon">
              {a.decided_by
                ? <><span className="initials">{a.decided_by.slice(0, 2).toUpperCase()}</span>{a.decided_by}</>
                : <><span className="icon-box icon-box--small"><Bot size={14} className="icon-success" /></span><span className="text-success">BOB agent</span></>}
            </div>
            <div className="cell-strong">{WORK_ORDERS.includes(a.kind) ? '—' : mw(Math.abs(a.mw))}</div>
            <div className="cell-strong">{a.delivered_mw === null ? '—' : mw(Math.abs(a.delivered_mw))}</div>
            <div>
              <span className={`badge badge--caps badge--${BADGE[statusOf(a.status).tag] ?? 'gray'}`} title={a.reason ?? undefined}>
                {statusOf(a.status).label}
              </span>
            </div>
            <div className="ledger__action">
              {a.cycle_id && <Link to={`/decisions/${a.cycle_id}`} className="button-outline">Details</Link>}
            </div>
          </div>
        ))}
      </div>

      <div className="ledger__foot">
        <span>Showing <strong>{rows.length ? `1–${rows.length}` : '0'}</strong> of <strong>{actions.data.length}</strong> actions</span>
        <span className="cell-sub">The latest {actions.data.length} actions in this run, newest first.</span>
      </div>
    </section>
  )
}
