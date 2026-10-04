import type { WhatIfPlan } from '../api/client'
import { mwh, netCost } from '../format'

const ROWS: Array<[string, (p: WhatIfPlan) => string]> = [
  ['Net cost (24 h)', (p) => netCost(p.net_cost_inr ?? 0)],
  ['Carbon', (p) => `${p.carbon_t} t`],
  ['Curtailed', (p) => mwh(p.curtailed_mwh ?? 0)],
  ['Unserved', (p) => mwh(p.unserved_mwh ?? 0)],
]

/** The plan for current conditions next to the what-if plan; `actions` adds what each would do now. */
export function WhatIfTable({ current, whatIf, actions = false }: {
  current: WhatIfPlan
  whatIf: WhatIfPlan
  actions?: boolean
}) {
  const plans = [current, whatIf]
  return (
    <table className="chat-card__table">
      <thead><tr><th /><th>Now</th><th>What-if</th></tr></thead>
      <tbody>
        {ROWS.map(([label, value]) => (
          <tr key={label}>
            <td>{label}</td>
            {plans.map((p, i) => <td key={i}>{p.feasible ? value(p) : 'No feasible plan'}</td>)}
          </tr>
        ))}
        {actions && (
          <tr>
            <td>This block</td>
            {plans.map((p, i) => <td key={i}>{p.actions?.map((a) => <div key={a}>{a}</div>)}</td>)}
          </tr>
        )}
      </tbody>
    </table>
  )
}
