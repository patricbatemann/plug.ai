import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Breadcrumb, BreadcrumbItem, Button, InlineNotification, SkeletonText, Tag, Tile, Toggle } from '@carbon/react'
import { Add } from '@carbon/icons-react'
import { configApi, portfolioApi } from '../api/client'
import { AUTONOMY, configKindLabel, limitsSummary } from '../format'

export function ConfigureBobPage() {
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const site = useQuery({ queryKey: ['site', code], queryFn: () => portfolioApi.site(code) })
  const configs = useQuery({ queryKey: ['configs', code], queryFn: () => configApi.list(code) })
  const toggle = useMutation({
    mutationFn: ({ id, on }: { id: number; on: boolean }) => configApi.setStatus(id, on ? 'active' : 'paused'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['configs', code] }),
  })
  if (configs.error) return <InlineNotification kind="error" title="Could not load the configuration" subtitle={configs.error.message} hideCloseButton lowContrast />
  if (!configs.data || !site.data) return <SkeletonText paragraph lineCount={6} />
  const active = configs.data.filter((c) => c.status === 'active').length

  return (
    <>
      <Breadcrumb noTrailingSlash>
        <BreadcrumbItem><Link to="/portfolio">Portfolio</Link></BreadcrumbItem>
        <BreadcrumbItem><Link to={`/sites/${code}`}>{site.data.name}</Link></BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>BOB</BreadcrumbItem>
      </Breadcrumb>
      <div className="page-head">
        <div>
          <h1 className="page-title">Configure BOB</h1>
          <p className="page-meta">
            What BOB may do at {site.data.name}, within which limits, and when it must ask. {configs.data.length}{' '}
            configured actions · {active} active.
          </p>
        </div>
        <Button renderIcon={Add} onClick={() => navigate(`/sites/${code}/bob/setup`)}>Add new action</Button>
      </div>
      {toggle.error && <InlineNotification kind="error" title={toggle.error.message} hideCloseButton lowContrast />}
      <div className="action-list">
        {configs.data.map((c) => (
          <Tile key={c.id} className="config-card">
            <div className="action-card__head">
              <Toggle
                id={`toggle-${c.id}`}
                size="sm"
                labelText=""
                aria-label={`${c.name} active`}
                labelA="Paused"
                labelB="Active"
                toggled={c.status === 'active'}
                disabled={!c.current}
                onToggle={(on) => toggle.mutate({ id: c.id, on })}
              />
              <h3 className="card-title">{c.name}</h3>
              {!c.current && <Tag size="sm" type="blue">draft v{c.version}</Tag>}
              <span className="stat-label">{c.actions_today} today</span>
            </div>
            <div className="config-card__body">
              <div>
                <div className="stat-label">Action</div>
                <p>{configKindLabel(c.kind)} · {c.asset_name}</p>
                <div className="stat-label">Watch conditions</div>
                {c.watch.length ? c.watch.map((w) => <p key={w.metric}>{w.metric.replace(/_/g, ' ')} {w.value}</p>) : <p>None</p>}
              </div>
              <div>
                <div className="stat-label">Execution rules</div>
                <p>{AUTONOMY[c.autonomy].label}</p>
                {limitsSummary(c.limits).map((l) => <p key={l}>{l}</p>)}
                <p>Approver responds within {c.approval.response_min ?? 10} min</p>
              </div>
            </div>
            <div className="action-card__foot">
              <Button kind="tertiary" size="sm" onClick={() => navigate(`/sites/${code}/bob/setup?asset=${c.asset}&kind=${c.kind}`)}>
                {c.current ? 'Edit action' : 'Continue setup'}
              </Button>
            </div>
          </Tile>
        ))}
      </div>
    </>
  )
}
