import { useQuery } from '@tanstack/react-query'
import { SkeletonText, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tag } from '@carbon/react'
import { runApi, type RunState } from '../api/client'
import { actionLabel, mw, simTime } from '../format'
import { ActionCard } from './ActionCard'
import { useOpenActions } from './useActions'

/** The site's AI Actions tab: what runs now, what waits for a person, and what ran recently. */
export function SiteActions({ run, site }: { run: RunState; site: string }) {
  const open = useOpenActions(run, site)
  const recent = useQuery({
    queryKey: ['actions', 'site', run.id, site, run.block],
    queryFn: () => runApi.actions(run.id, { status: ['acked', 'verified'], site, limit: 15 }),
  })
  if (!open.data || !recent.data) return <SkeletonText paragraph lineCount={4} />
  const now = recent.data.filter((a) => a.block === run.block + 1)
  const earlier = recent.data.filter((a) => a.block <= run.block)

  return (
    <div className="live">
      <h2 className="section-title">Currently executing ({now.length})</h2>
      <ActionTable rows={now} empty="No setpoints for this site in the current block." />
      <h2 className="section-title">Pending approval ({open.data.length})</h2>
      {open.data.length === 0 && <p className="page-meta">Nothing waiting for this site.</p>}
      {open.data.map((a) => (
        <ActionCard key={a.id} action={a} run={run} />
      ))}
      <h2 className="section-title">Recently verified</h2>
      <ActionTable rows={earlier} empty="No verified actions yet." />
    </div>
  )
}

function ActionTable({ rows, empty }: { rows: Awaited<ReturnType<typeof runApi.actions>>; empty: string }) {
  if (rows.length === 0) return <p className="page-meta">{empty}</p>
  return (
    <Table aria-label="Site actions">
      <TableHead>
        <TableRow>
          <TableHeader>Block</TableHeader>
          <TableHeader>Action</TableHeader>
          <TableHeader>Commanded</TableHeader>
          <TableHeader>Measured</TableHeader>
          <TableHeader>Status</TableHeader>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((a) => (
          <TableRow key={a.id}>
            <TableCell>{simTime(a.time)}</TableCell>
            <TableCell>
              {actionLabel(a.kind, a.mw)}
              {a.asset && <div className="stat-label">{a.asset}</div>}
            </TableCell>
            <TableCell>{mw(Math.abs(a.mw))}</TableCell>
            <TableCell>{a.actual_mw === null ? '—' : mw(a.actual_mw)}</TableCell>
            <TableCell>
              <Tag size="sm" type={a.status === 'verified' ? 'green' : 'blue'}>
                {a.status === 'acked' ? 'executing' : a.status}
              </Tag>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
