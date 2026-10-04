import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Checkbox, SkeletonText, Tag } from '@carbon/react'
import { siteApi, type RunState } from '../api/client'
import { actionLabel, mw, simTime } from '../format'

const CATEGORIES = {
  decisions: { label: 'Decisions', tag: 'purple' },
  actions: { label: 'Actions', tag: 'blue' },
  maintenance: { label: 'Maintenance', tag: 'teal' },
  events: { label: 'Events', tag: 'warm-gray' },
  documents: { label: 'Documents', tag: 'cyan' },
  configuration: { label: 'Configuration', tag: 'gray' },
} as const

const STATUS: Record<string, string> = {
  awaiting_approval: 'awaiting approval', acked: 'executed', verified: 'executed', declined: 'declined',
  expired: 'expired unanswered', recommended: 'recommended', rejected: 'blocked by a safety check',
}

/** What happened at the site and why, newest first. */
export function SiteActivity({ run, site }: { run: RunState; site: string }) {
  const [shown, setShown] = useState<string[]>(Object.keys(CATEGORIES))
  const { data } = useQuery({
    queryKey: ['activity', run.id, site, run.block, shown],
    queryFn: () => siteApi.activity(run.id, site, shown),
    enabled: shown.length > 0,
  })
  return (
    <div className="live">
      <div className="tag-row">
        {Object.entries(CATEGORIES).map(([key, c]) => (
          <Checkbox key={key} id={`show-${key}`} labelText={c.label} checked={shown.includes(key)}
            onChange={(_, { checked }) => setShown(checked ? [...shown, key] : shown.filter((s) => s !== key))} />
        ))}
      </div>
      {!data && shown.length > 0 && <SkeletonText paragraph lineCount={6} />}
      {data?.length === 0 && <p className="page-meta">Nothing yet for these categories.</p>}
      {data?.map((e, i) => {
        const c = CATEGORIES[e.category as keyof typeof CATEGORIES]
        return (
          <div key={i} className="activity__entry">
            <span className="stat-label">{simTime(e.at)}</span>
            <Tag size="sm" type={c.tag}>{c.label}</Tag>
            <div>
              <strong>
                {e.title ?? `${actionLabel(e.kind!, e.mw!)}${e.mw ? ` · ${mw(Math.abs(e.mw))}` : ''} · ${e.asset}`}
              </strong>
              {e.status && <span className="stat-label"> · {STATUS[e.status] ?? e.status}</span>}
              {e.detail && <p>{e.detail}</p>}
              {e.by && <p className="stat-label">By {e.by}</p>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
