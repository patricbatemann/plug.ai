import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ToastNotification } from '@carbon/react'
import { runApi } from '../api/client'
import { simTime } from '../format'
import { useCurrentRun } from './useCurrentRun'

interface Toast {
  id: number
  title: string
  subtitle: string
}

/** A toast for each world event as it fires; events from before the page opened are not replayed. */
export function EventToasts() {
  const { data: run } = useCurrentRun()
  const [cursor, setCursor] = useState<{ run: number; id: number } | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const after = cursor && cursor.run === run?.id ? cursor.id : 0
  const { data } = useQuery({
    queryKey: ['events', run?.id, after],
    queryFn: () => runApi.events(run!.id, after),
    enabled: !!run,
    refetchInterval: 2000,
  })

  useEffect(() => {
    if (!run || !data) return
    // The first page of events only sets the cursor; later pages are new and get toasts.
    if (cursor?.run !== run.id) {
      setCursor({ run: run.id, id: data.length ? data[data.length - 1].id : 0 })
      return
    }
    if (data.length === 0) return
    setToasts((current) => [
      ...current,
      ...data.map((e) => ({ id: e.id, title: e.label, subtitle: `${simTime(e.sim_at)} IST · ${e.source}` })),
    ])
    setCursor({ run: run.id, id: data[data.length - 1].id })
  }, [data, run, cursor])

  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <ToastNotification
          key={t.id}
          kind="info"
          lowContrast
          title={t.title}
          subtitle={t.subtitle}
          timeout={6000}
          onClose={() => {
            setToasts((current) => current.filter((x) => x.id !== t.id))
            return false
          }}
        />
      ))}
    </div>
  )
}
