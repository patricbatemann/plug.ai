import { statusOf } from '../format'

const TONE: Record<string, string> = { green: 'green', blue: 'blue', red: 'red', 'warm-gray': 'amber' }

/** An action's status as a coloured caps badge, with the reason as its tooltip. */
export function StatusBadge({ status, reason }: { status: string; reason?: string | null }) {
  const { label, tag } = statusOf(status)
  return <span className={`badge badge--caps badge--${TONE[tag] ?? 'gray'}`} title={reason ?? undefined}>{label}</span>
}
