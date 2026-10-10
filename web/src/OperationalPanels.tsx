import { Link, useLocation, useSearchParams } from "react-router"
import { useTransactions } from "./portfolio"
import { useOperations } from "./Operations"
import { CONFIG_STEPS, SITE } from "./data"
import { useQuery } from "@tanstack/react-query"
import { documentApi } from "./api/client"
import { simDateTime } from "./format"
import { useCurrentRun } from "./runs/useCurrentRun"

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
  const { state, edit } = useOperations()
  const [params] = useSearchParams()
  const transaction = useTransactions().find(
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
          {page === "askBob"
              ? "Ask BOB · Activity summary"
              : page === "protected"
                ? "Protected boundary"
                : page === "workOrder"
                  ? `Maintenance · ${SITE.name}`
                  : page === "actionDetails"
                    ? "Action details"
                    : "Operational details"}
        </h1>
        {page === "transaction" && (
          <section className="space-y-4 border border-[#e0e0e0] bg-white p-6">
            <h2 className="font-semibold">
              Transaction {transaction?.id ?? "not found"}
            </h2>
            {transaction && (
              <dl className="space-y-3 text-sm">
                {[
                  ["Date", transaction.date + " IST"],
                  ["Site", transaction.site],
                  ["Type", transaction.type],
                  ["Initiated by", transaction.initiator],
                  ["Energy", transaction.amount],
                  ["Tier", transaction.tier],
                  ["State", transaction.status],
                  ["Reason", transaction.reason || "—"],
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
                onClick={() => edit(3)}
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
              <Link
                to="/protected"
                className="inline-flex min-h-11 items-center text-sm text-[#0f62fe]"
              >
                View protected boundary
              </Link>
            </div>
          </section>
        )}
        {page === "workOrder" && <WorkOrders />}

      </div>
    </main>
  )
}

function WorkOrders() {
  const run = useCurrentRun().data
  const tasks = useQuery({
    queryKey: ["maintenance", run?.id, run?.block, SITE.id],
    queryFn: () => documentApi.maintenance(run!.id, SITE.id),
    enabled: !!run,
  }).data?.tasks
  return (
    <section className="space-y-3 border border-[#e0e0e0] bg-white p-5">
      {tasks?.length === 0 && <p className="text-sm">No maintenance is scheduled at this site.</p>}
      {tasks?.map((task) => (
        <div key={task.id} className="border-b border-[#e0e0e0] pb-3 text-sm last:border-0">
          <p className="font-semibold text-[#161616]">{task.asset} · {task.kind}</p>
          <p>
            {simDateTime(task.scheduled_at)} IST · {task.hours} h · {task.status}
            {task.safety_critical ? " · Safety critical" : ""}
          </p>
        </div>
      ))}
      <p className="text-sm">No shutdown or remote-control authorization is implied by a work order.</p>
      <Link to="/siteDetail" className="inline-flex min-h-11 items-center text-[#0f62fe] underline">
        Return to site details
      </Link>
    </section>
  )
}
