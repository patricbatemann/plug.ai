import { Tag } from '@carbon/react'
import { modeLabel } from '../format'
import { useCurrentRun } from './useCurrentRun'

const BY = { operator: 'operator', rule: 'rule', bob: 'BOB' } as Record<string, string>
const TITLE = { operator: "The operator's default mode", rule: 'Switched by rule for the situation', bob: 'Switched by BOB for the situation' } as Record<string, string>

/** The operating mode in force: the run's, or the portfolio default when no run exists. */
export function ModeTag({ defaultMode }: { defaultMode: string }) {
  const { data: run } = useCurrentRun()
  const mode = run?.mode ?? defaultMode
  return (
    <Tag type="purple" title={TITLE[run?.mode_by ?? 'operator']}>
      {modeLabel(mode)} · {BY[run?.mode_by ?? 'operator']}
    </Tag>
  )
}
