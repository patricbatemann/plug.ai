import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Checkbox, SkeletonText } from '@carbon/react'
import { siteApi, type RunState } from '../api/client'
import { actionLabel, mw, simTime, statusOf } from '../format'

const CATEGORIES = {
  decisions: { label: 'Decisions', tone: 'purple' },
  actions: { label: 'Actions', tone: 'blue' },
  maintenance: { label: 'Maintenance', tone: 'green' },
  events: { label: 'Events', tone: 'amber' },
  documents: { label: 'Documents', tone: 'blue' },
  configuration: { label: 'Configuration', tone: 'gray' },
} as const

/** What happened at the site and why, newest first. */
export function SiteActivity({ run, site }: { run: RunState; site: string }) {
  const [shown, setShown] = useState<string[]>(Object.keys(CATEGORIES))
  const { data } = useQuery({
    queryKey: ['activity', run.id, site, run.block, shown],
    queryFn: () => siteApi.activity(run.id, site, shown),
    enabled: shown.length > 0,
  })
  return (
    <div className="stack">
      <div className="panel filter-bar">
        <span className="caps-label">Show</span>
        {Object.entries(CATEGORIES).map(([key, c]) => (
          <Checkbox key={key} id={`show-${key}`} labelText={c.label} checked={shown.includes(key)}
            onChange={(_, { checked }) => setShown(checked ? [...shown, key] : shown.filter((s) => s !== key))} />
        ))}
      </div>
      {!data && shown.length > 0 && <SkeletonText paragraph lineCount={6} />}
      {data?.length === 0 && <div className="panel panel--padded">Nothing yet for these categories.</div>}
      {!!data?.length && (
        <div className="panel">
          {data.map((e, i) => {
            const c = CATEGORIES[e.category as keyof typeof CATEGORIES]
            return (
              <div key={i} className="entry">
                <span className="cell-sub">{simTime(e.at)} IST · <span className={`badge badge--${c.tone}`}>{c.label}</span></span>
                <strong>
                  {e.title ?? `${actionLabel(e.kind!, e.mw!)}${e.mw ? ` · ${mw(Math.abs(e.mw))}` : ''} · ${e.asset}`}
                  {e.status && <span className="cell-sub"> · {statusOf(e.status).label}</span>}
                </strong>
                {e.detail && <p>{e.detail}</p>}
                {e.by && <p className="cell-sub">By {e.by}</p>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
