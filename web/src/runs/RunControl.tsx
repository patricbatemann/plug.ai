import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { IconButton, InlineLoading, MenuButton, MenuItem, Tag } from '@carbon/react'
import { Pause, Play, SkipForward } from '@carbon/icons-react'
import { portfolioApi, runApi } from '../api/client'
import { simTime } from '../format'
import { EVENT_FORMS, InjectEventModal } from './InjectEventModal'
import { useCurrentRun, useRunAction } from './useCurrentRun'

const SPEEDS = [10, 30, 60]
const STATUS_TAG = { running: 'green', paused: 'warm-gray', done: 'gray' } as const

export function RunControl() {
  const { data: run } = useCurrentRun()
  const presets = useQuery({ queryKey: ['presets'], queryFn: runApi.presets })
  const portfolio = useQuery({ queryKey: ['portfolio'], queryFn: portfolioApi.get })
  const action = useRunAction()
  const [injecting, setInjecting] = useState<string | null>(null)

  const newRun = (
    <MenuButton label="New run" kind="ghost" size="sm" menuAlignment="bottom-end">
      {(presets.data ?? []).map((p) => (
        <MenuItem key={p.code} label={p.name} onClick={() => action.mutate(() => runApi.create(p.code))} />
      ))}
    </MenuButton>
  )
  if (!run) return <div className="run-control">{newRun}</div>

  const running = run.status === 'running'
  return (
    <div className="run-control">
      <span className="run-control__clock">
        {run.name} · {simTime(run.sim_time)} IST
      </span>
      {!run.live && run.status !== 'done' ? (
        <InlineLoading description="Fast-forwarding" />
      ) : (
        <Tag size="sm" type={STATUS_TAG[run.status]}>
          {run.status}
        </Tag>
      )}
      {run.status !== 'done' && (
        <>
          <IconButton
            label={running ? 'Pause' : 'Play'}
            kind="ghost"
            size="sm"
            onClick={() => action.mutate(() => (running ? runApi.pause(run.id) : runApi.play(run.id)))}
          >
            {running ? <Pause /> : <Play />}
          </IconButton>
          <IconButton
            label="Step one block"
            kind="ghost"
            size="sm"
            disabled={running}
            onClick={() => action.mutate(() => runApi.step(run.id))}
          >
            <SkipForward />
          </IconButton>
          <MenuButton label={`${run.speed}×`} kind="ghost" size="sm">
            {SPEEDS.map((s) => (
              <MenuItem key={s} label={`${s}×`} onClick={() => action.mutate(() => runApi.speed(run.id, s))} />
            ))}
          </MenuButton>
          <MenuButton label="Inject event" kind="ghost" size="sm" menuAlignment="bottom-end">
            {Object.entries(EVENT_FORMS).map(([kind, form]) => (
              <MenuItem key={kind} label={form.title} onClick={() => setInjecting(kind)} />
            ))}
          </MenuButton>
        </>
      )}
      {newRun}
      {action.error && <span className="run-control__error">{action.error.message}</span>}
      {injecting && portfolio.data && (
        <InjectEventModal
          kind={injecting}
          portfolio={portfolio.data}
          onClose={() => setInjecting(null)}
          onSubmit={(event) => {
            action.mutate(() => runApi.inject(run.id, event))
            setInjecting(null)
          }}
        />
      )}
    </div>
  )
}
