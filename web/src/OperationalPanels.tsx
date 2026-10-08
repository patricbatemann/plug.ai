import { Link, useLocation, useSearchParams } from "react-router"
import { BOB_ACTION_TEMPLATES } from "./BobActions"
import { transactions } from "./Transactions"
import { useOperations } from "./Operations"
import { useProfile } from "./auth/user"
import { CONFIG_STEPS } from "./data"

export function JourneyNavigation() {
  const location = useLocation()
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#e0e0e0] bg-white px-4 py-2 font-['IBM Plex Sans:Regular'] text-xs">
      <nav
        aria-label="Operational journey"
        className="flex max-w-full gap-6 overflow-x-auto"
      >
        {[
          ["/", "Portfolio"],
          ["/aiRec", "AI recommendations"],
          ["/askBob", "Ask BOB"],
        ].map(([to, label]) => {
          const isActive = to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={`flex min-h-11 shrink-0 items-center font-['IBM Plex Sans:Medium'] text-[13px] transition-colors ${
                isActive
                  ? "text-[#0f62fe] font-semibold underline decoration-2 underline-offset-8"
                  : "text-[#525252] hover:text-[#0f62fe]"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  )
}

export default function OperationalPanels({ page }: { page: string }) {
  const { state, flow, edit, addAudit, setState } = useOperations()
  const profile = useProfile()
  const [params] = useSearchParams()
  const template = BOB_ACTION_TEMPLATES.find(
    (action) => action.id === params.get("template"),
  )
  const transaction = transactions(state).find(
    (row) => row.id === params.get("id"),
  )
  return (
    <main className="min-h-[80dvh] bg-[#f4f4f4] p-4 text-[#161616] md:p-8 font-['IBM Plex Sans:Regular']">
      <div className="mx-auto max-w-4xl space-y-5">
        <Link
          to={state.activated ? "/monitoring" : "/bob"}
          className="inline-flex min-h-11 items-center text-sm text-[#0f62fe]"
        >
          ← Back to {state.activated ? "active monitoring" : "BOB actions"}
        </Link>
        <h1 className="text-2xl font-semibold">
          {page === "actionTemplate"
            ? `Action template · ${template?.title ?? "Not found"}`
            : page === "askBob"
              ? "Ask BOB · Activity summary"
              : page === "protected"
                ? "Protected boundary"
                : page === "workOrder"
                  ? "Work order WO-4521"
                  : page === "actionDetails"
                    ? "Action details"
                    : "Operational details"}
        </h1>
        {page === "actionTemplate" && template && (
          <section className="space-y-4 border border-[#e0e0e0] bg-white p-6">
            <p className="text-sm">
              Draft template — not activated. {template.description}
            </p>
            <h2 className="font-semibold">Trigger conditions</h2>
            <ul className="space-y-2 text-sm">
              {template.triggers.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
            <h2 className="font-semibold">Effective safety rules</h2>
            <ul className="space-y-2 text-sm">
              {template.rules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
            <p className="text-sm">
              This template cannot execute without its own configuration,
              permission verification, simulation evidence, and activation. The
              current supported configuration journey is Battery 1 demand
              support.
            </p>
            <div className="flex flex-wrap gap-4 text-sm text-[#0f62fe]">
              <Link to="/protected">Inspect protected rule</Link>
              <Link to="/workOrder">Open work order</Link>
              <Link to="/askBob">Ask BOB about this template</Link>
              <Link to="/bob">Return to View AI Actions</Link>
            </div>
          </section>
        )}
        {page === "transaction" && (
          <section className="space-y-4 border border-[#e0e0e0] bg-white p-6">
            <h2 className="font-semibold">
              Transaction {transaction?.id ?? "not found"}
            </h2>
            {transaction && (
              <dl className="space-y-3 text-sm">
                {[
                  ["Date", transaction.date + ", 2026 IST"],
                  ["Type", transaction.type],
                  ["Initiated by", transaction.initiator],
                  ["Energy", transaction.amount],
                  ["Revenue / cost", transaction.revenue],
                  ["State", transaction.status],
                  [
                    "Evidence",
                    transaction.historical
                      ? "Historical preview record, before the canonical snapshot"
                      : "Current approval outcome; no delivered energy reported yet",
                  ],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex flex-wrap justify-between gap-3"
                  >
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            )}
            <Link
              to="/siteDetail"
              className="inline-flex min-h-11 items-center text-sm text-[#0f62fe]"
            >
              Return to site details
            </Link>
          </section>
        )}
        {page === "protected" && (
          <section className="space-y-4 border-l-4 border-[#da1e28] bg-white p-6">
            <h2 className="font-semibold">
              Unsafe request blocked — effective policy unchanged
            </h2>
            <p className="text-sm">
              The 30% emergency floor is immutable. Discharge stops at the
              configured reserve (at least 55%). Automatic output cannot exceed
              6 MW; equipment output cannot exceed 8 MW, even with approval.
            </p>
            <details className="border border-[#e0e0e0] p-4">
              <summary className="min-h-11 cursor-pointer font-semibold">
                Inspect rule and safety evidence
              </summary>
              <p className="text-sm leading-6">
                Start only above 60% SOC after a deficit above 3 MW persists for
                5 minutes. Stop at the first reserve, 30-minute, or 3 MWh
                boundary. High temperature, maintenance, abnormal health,
                unavailable battery, telemetry older than two minutes, or failed
                checks block execution. Administrator approval expires after 10
                minutes and never overrides safety.
              </p>
            </details>
            <div className="flex flex-wrap gap-4">
              <Link
                to="/agentChat"
                onClick={() => {
                  edit(3)
                  addAudit(
                    "Safe alternative selected",
                    "Safety limits opened for review; no immutable policy changed.",
                  )
                }}
                className="bg-[#0f62fe] px-4 py-3 text-sm text-white"
              >
                Choose a safe alternative
              </Link>
              <Link
                to="/bob"
                className="border border-[#8d8d8d] px-4 py-3 text-sm"
              >
                Cancel request
              </Link>
            </div>
          </section>
        )}
        {page === "actionDetails" && (
          <section className="space-y-4 border border-[#e0e0e0] bg-white p-5">
            <h2 className="font-semibold">Support demand using Battery 1</h2>
            <p className="text-sm">
              {state.stage} · Battery 1 ·{" "}
              {state.activated
                ? "Effective policy shown below; edits create a proposed revision."
                : "Proposed configuration; activation required."}
            </p>
            {CONFIG_STEPS.map((label, step) => (
              <div
                key={label}
                className="flex flex-wrap justify-between gap-3 border-b border-[#e0e0e0] py-3 text-sm"
              >
                <span>{label}</span>
                <Link
                  to="/agentChat"
                  onClick={() => edit(step)}
                  className="text-[#0f62fe]"
                >
                  Edit {label}
                </Link>
              </div>
            ))}
            <pre className="overflow-auto bg-[#f4f4f4] p-4 text-xs">
              {JSON.stringify(state.activeConfig ?? state.config, null, 2)}
            </pre>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  addAudit("Action details saved", `Battery 1 configuration details saved by ${profile?.name ?? "the operator"}.`);
                  alert("Action details saved successfully.");
                }}
                className="flex min-h-11 items-center gap-2 rounded-[2px] bg-[#0f62fe] px-4 text-xs font-semibold text-white hover:bg-[#0043ce] transition-colors cursor-pointer shadow-xs"
              >
                <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Save details
              </button>
              <Link
                to="/protected"
                className="inline-flex min-h-11 items-center text-sm text-[#0f62fe]"
              >
                View protected boundary
              </Link>
            </div>
          </section>
        )}
        {page === "workOrder" && (
          <section className="space-y-4 border border-[#e0e0e0] bg-white p-6">
            <p className="text-sm">
              Kuppam Solar · Inverter 01 · Panel cleaning
            </p>
            <p className="text-sm">
              Historical preview record · 1 October 2026, 12:50 IST · Status:
              Open · Assigned to maintenance team.
            </p>
            <p className="text-sm">
              No shutdown or remote-control authorization is implied by this
              work order.
            </p>
            <Link to="/siteDetail" className="text-sm text-[#0f62fe]">
              Return to site details
            </Link>
          </section>
        )}

        <section className="space-y-3 border border-[#e0e0e0] bg-white p-4">
          <label className="flex flex-wrap items-center gap-3 text-xs">
            Preview permission role
            <select
              aria-label="Preview permission role"
              value={state.role}
              onChange={(event) =>
                setState((current) => ({
                  ...current,
                  role: event.target.value as "operator" | "administrator",
                }))
              }
              className="min-h-11 border border-[#8d8d8d] px-3"
            >
              <option value="operator">
                Operator (no approval permission)
              </option>
              <option value="administrator">
                Administrator (preview only)
              </option>
            </select>
          </label>
          <p className="text-xs">
            Grid remote control:{" "}
            {state.gridRemoteAvailable
              ? "Adapter capability verified"
              : "Unavailable"}
            . BOB grid permission:{" "}
            {state.gridControlGranted ? "Granted" : "Not granted"}.
          </p>
          {state.gridRemoteAvailable && (
            <button
              disabled={state.role !== "administrator"}
              onClick={() => {
                setState((current) => ({
                  ...current,
                  gridControlGranted: !current.gridControlGranted,
                }))
                addAudit(
                  "Grid control permission updated",
                  state.gridControlGranted
                    ? "Administrator revoked preview BOB grid-control permission."
                    : "Administrator explicitly granted preview BOB grid-control permission after adapter verification. Existing approvals are not automatically executed.",
                )
              }}
              className="min-h-11 border border-[#8d8d8d] px-4 text-xs disabled:opacity-50"
            >
              {state.gridControlGranted ? "Revoke" : "Grant"} BOB grid
              permission
            </button>
          )}
          <p className="text-xs text-[#6f6f6f]">
            This selector tests UI permissions only. Production authorization
            must be enforced by the backend.
          </p>
        </section>
      </div>
    </main>
  )
}
