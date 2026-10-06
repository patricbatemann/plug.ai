import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, InlineNotification, SkeletonText, Toggle } from '@carbon/react'
import { Add, Checkmark, ChevronDown, ChevronUp, Search } from '@carbon/icons-react'
import { configApi, portfolioApi, type ConfigOut } from '../api/client'
import { AUTONOMY, configKindLabel, limitsSummary } from '../format'

const FILTERS = {
  all: { label: 'All', match: () => true },
  active: { label: 'Active', match: (c: ConfigOut) => c.current && c.status === 'active' },
  paused: { label: 'Paused', match: (c: ConfigOut) => c.current && c.status === 'paused' },
  drafts: { label: 'Drafts', match: (c: ConfigOut) => !c.current },
}

export function ConfigureBobPage() {
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const site = useQuery({ queryKey: ['site', code], queryFn: () => portfolioApi.site(code) })
  const configs = useQuery({ queryKey: ['configs', code], queryFn: () => configApi.list(code) })
  const [filter, setFilter] = useState<keyof typeof FILTERS>('all')
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState<number | null>(null)
  const toggle = useMutation({
    mutationFn: ({ id, on }: { id: number; on: boolean }) => configApi.setStatus(id, on ? 'active' : 'paused'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['configs', code] }),
  })
  if (configs.error) return <InlineNotification kind="error" title="Could not load the configuration" subtitle={configs.error.message} hideCloseButton lowContrast />
  if (!configs.data || !site.data) return <SkeletonText paragraph lineCount={6} />

  const count = (key: keyof typeof FILTERS) => configs.data.filter(FILTERS[key].match).length
  const shown = configs.data
    .filter(FILTERS[filter].match)
    .filter((c) => `${c.name} ${c.asset_name} ${configKindLabel(c.kind)}`.toLowerCase().includes(search.toLowerCase()))

  return (
    <>
      <div className="site-head site-head--roomy">
        <nav className="crumbs crumbs--links" aria-label="Breadcrumb">
          <Link to="/portfolio">Sites</Link><span>/</span><Link to={`/sites/${code}`}>{site.data.name}</Link><span>/</span><span>BOB</span>
        </nav>
        <div className="site-head__top">
          <h1 className="page-title">Configure BOB</h1>
          <Button className="btn-tall" renderIcon={Add} onClick={() => navigate(`/sites/${code}/bob/setup`)}>Add new action</Button>
        </div>
        <p className="site-head__meta">What BOB may do at {site.data.name}, within which limits, and when it must ask.</p>
        <p className="site-head__stats">
          Configured actions <strong>{configs.data.length}</strong> · Active <strong>{count('active')}</strong> · Paused{' '}
          <strong>{count('paused')}</strong> · Drafts <strong>{count('drafts')}</strong>
        </p>
        <div className="filter-tabs">
          <div className="filter-tabs__tabs" role="tablist" aria-label="Filter actions">
            {(Object.keys(FILTERS) as Array<keyof typeof FILTERS>).map((key) => (
              <button key={key} type="button" role="tab" aria-selected={filter === key} onClick={() => setFilter(key)}>
                {FILTERS[key].label} ({count(key)})
              </button>
            ))}
          </div>
          <label className="field field--well filter-tabs__search">
            <Search size={16} />
            <input aria-label="Search actions" placeholder="Search actions…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
        </div>
      </div>

      {toggle.error && <InlineNotification kind="error" title={toggle.error.message} hideCloseButton lowContrast />}
      <div className="stack stack--tight">
        {shown.length === 0 && <div className="panel panel--padded">No actions match.</div>}
        {shown.map((c) => {
          const expanded = open === c.id
          return (
            <div key={c.id} className={`panel config${expanded ? ' config--open' : ''}`}>
              <div className="config__head">
                <Toggle id={`toggle-${c.id}`} size="sm" labelText="" hideLabel aria-label={`${c.name} active`}
                  toggled={c.current && c.status === 'active'} disabled={!c.current}
                  onToggle={(on) => toggle.mutate({ id: c.id, on })} />
                <button type="button" className="config__summary" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : c.id)}>
                  <span>
                    <span className="config__name">
                      {c.name}
                      <span className={`badge badge--${!c.current ? 'gray' : c.status === 'active' ? 'green' : 'amber'}`}>
                        {!c.current ? `Draft v${c.version}` : c.status === 'active' ? 'Active' : 'Paused'}
                      </span>
                    </span>
                    <span className="cell-sub">{configKindLabel(c.kind)} · {c.asset_name} · {AUTONOMY[c.autonomy].label.toLowerCase()}</span>
                  </span>
                  <span className="chip chip--round">{c.actions_today} today</span>
                  {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>
              {expanded && (
                <div className="config__body">
                  <div className="two-col">
                    <div>
                      <h3 className="caps-label caps-label--strong">Trigger conditions</h3>
                      <ul className="ticks">
                        <li><Checkmark size={14} />When BOB's plan calls for {configKindLabel(c.kind).toLowerCase()} on {c.asset_name}</li>
                        {c.watch.map((w) => <li key={w.metric}><Checkmark size={14} />Watch: {w.metric.replace(/_/g, ' ')} {w.value}</li>)}
                      </ul>
                    </div>
                    <div>
                      <h3 className="caps-label caps-label--strong">Execution rules</h3>
                      <ul className="ticks ticks--plain">
                        <li>{AUTONOMY[c.autonomy].label}</li>
                        {limitsSummary(c.limits).map((l) => <li key={l}>{l}</li>)}
                        <li>Approver responds within {c.approval.response_min ?? 10} min</li>
                      </ul>
                    </div>
                  </div>
                  <div className="config__foot">
                    <Button kind="tertiary" className="btn-tall" onClick={() => navigate(`/sites/${code}/bob/setup?asset=${c.asset}&kind=${c.kind}`)}>
                      {c.current ? 'Edit action' : 'Continue setup'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
