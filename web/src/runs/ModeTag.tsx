import { Tag } from '@carbon/react'
import { modeLabel } from '../format'
import { useCurrentRun } from './useCurrentRun'

const BY = { operator: 'operator default', rule: 'set by rule', bob: 'set by BOB' } as Record<string, string>

/** The operating mode in force: the run's, or the portfolio default when no run exists. */
export function ModeTag({ defaultMode }: { defaultMode: string }) {
  const { data: run } = useCurrentRun()
  const mode = run?.mode ?? defaultMode
  return (
    <Tag type="purple" title={run ? BY[run.mode_by] : BY.operator}>
      Mode: {modeLabel(mode)} · {run ? BY[run.mode_by] : BY.operator}
    </Tag>
  )
}
