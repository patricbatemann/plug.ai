import { useQuery } from '@tanstack/react-query'
import { SkeletonText, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tag } from '@carbon/react'
import { runApi } from '../api/client'
import { actionLabel, mw, simTime } from '../format'
import { ActionCard } from '../runs/ActionCard'
import { useOpenActions } from '../runs/useActions'
import { useCurrentRun } from '../runs/useCurrentRun'

export function ActionsPage() {
  const { data: run } = useCurrentRun()
  const open = useOpenActions(run)
  const executing = useQuery({
    queryKey: ['actions', 'executing', run?.id, run?.block],
    queryFn: () => runApi.actions(run!.id, { status: ['acked'], block: run!.block + 1, limit: 50 }),
    enabled: !!run,
  })

  return (
    <>
      <h1 className="page-title">All AI recommendations</h1>
      <p className="page-meta">
        Actions BOB wants to take but may not take alone: approve or decline before the window closes. Nothing
        gated runs until it is approved; BOB keeps a fallback plan running meanwhile.
      </p>
      {!run ? (
        <p>Start a run from the header to see BOB's recommendations.</p>
      ) : !open.data ? (
        <SkeletonText paragraph lineCount={4} />
      ) : (
        <>
          <h2 className="section-title">Recommendations requiring attention ({open.data.length})</h2>
          {open.data.length === 0 && <p className="page-meta">Nothing needs you right now.</p>}
          <div className="action-list">
            {open.data.map((a) => (
              <ActionCard key={a.id} action={a} run={run} />
            ))}
          </div>

          <h2 className="section-title">Executing this block</h2>
          <Table aria-label="Executing actions">
            <TableHead>
              <TableRow>
                <TableHeader>Action</TableHeader>
                <TableHeader>Site</TableHeader>
                <TableHeader>Amount</TableHeader>
                <TableHeader>Approved by</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {(executing.data ?? []).map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    {actionLabel(a.kind, a.mw)} <span className="stat-label">· {simTime(a.time)}</span>
                  </TableCell>
                  <TableCell>{a.site ?? 'Portfolio'}</TableCell>
                  <TableCell>{mw(Math.abs(a.delivered_mw ?? a.mw))}</TableCell>
                  <TableCell>{a.decided_by ?? <Tag size="sm" type="purple">BOB, within limits</Tag>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </>
  )
}
