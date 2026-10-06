import { Tag } from '@carbon/react'
import type { RunState } from '../api/client'
import { modeLabel } from '../format'
import { useCurrentRun } from './useCurrentRun'

const BY = { operator: 'operator', rule: 'rule', bob: 'BOB' } as Record<string, string>
const TITLE = { operator: "The operator's default mode", rule: 'Switched by rule for the situation', bob: 'Switched by BOB for the situation' } as Record<string, string>

/** The operating mode in force and who set it: the run's, or the portfolio default when no run exists. */
export const modeText = (run: RunState | null | undefined, defaultMode: string) =>
  `${modeLabel(run?.mode ?? defaultMode)} · ${BY[run?.mode_by ?? 'operator']}`

export function ModeTag({ defaultMode }: { defaultMode: string }) {
  const { data: run } = useCurrentRun()
  return (
    <Tag type="purple" title={TITLE[run?.mode_by ?? 'operator']}>
      {modeText(run, defaultMode)}
    </Tag>
  )
}
