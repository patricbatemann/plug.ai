import { Link, useLocation, useSearchParams } from "react-router"
import { useTransactions } from "./portfolio"
import { SITE } from "./data"
import { AUTONOMY, limitsSummary } from "./format"
import { useSite } from "./site"
import { useQuery } from "@tanstack/react-query"
import { documentApi, portfolioApi } from "./api/client"
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
  const { configs, floorPct, siteName } = useSite()
  const ceiling = useQuery({ queryKey: ["portfolio"], queryFn: portfolioApi.get }).data?.protected.approval_above_mw
  const [params] = useSearchParams()
  const transaction = useTransactions().find(
    (row) => row.id === params.get("id"),
  )
  return (
    <main className="min-h-[80dvh] bg-[#f4f4f4] p-4 text-[#161616] md:p-8 font-['IBM Plex Sans:Regular']">
      <div className="mx-auto max-w-4xl space-y-5">
        <Link
          to="/bob"
          className="inline-flex min-h-11 items-center text-sm text-[#0f62fe]"
        >
          ← Back to BOB actions
        </Link>
        <h1 className="text-2xl font-semibold">
          {page === "askBob"
              ? "Ask BOB · Activity summary"
              : page === "protected"
                ? "Protected boundary"
                : page === "workOrder"
                  ? `Maintenance · ${siteName}`
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
            <h2 className="font-semibold">Limits BOB cannot cross</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {floorPct != null && <li>No battery is discharged below the organisation’s {floorPct}% floor, whatever a configuration says.</li>}
              {ceiling != null && <li>Any action above {ceiling} MW always needs a person’s approval.</li>}
              <li>Every action passes an independent safety check before it is sent; an approval never overrides it.</li>
            </ul>
            {configs.map((c) => (
              <div key={c.id} className="border border-[#e0e0e0] p-4 text-sm">
                <p className="font-semibold">{c.name} · {c.status}</p>
                <ul className="list-disc pl-5">{[AUTONOMY[c.autonomy].label, ...limitsSummary(c.limits)].map((line) => <li key={line}>{line}</li>)}</ul>
              </div>
            ))}
            <div className="flex flex-wrap gap-4">
              <Link to="/agentChat" className="bg-[#0f62fe] px-4 py-3 text-sm text-white">Change the discharge limits</Link>
              <Link to="/bob" className="border border-[#8d8d8d] px-4 py-3 text-sm">Back</Link>
            </div>
          </section>
        )}
        {page === "actionDetails" && (
          <section className="space-y-4 border border-[#e0e0e0] bg-white p-5">
            <h2 className="font-semibold">Configured actions at {siteName}</h2>
            {configs.map((c) => (
              <div key={c.id} className="flex flex-wrap justify-between gap-3 border-b border-[#e0e0e0] py-3 text-sm">
                <div>
                  <p className="font-semibold">{c.name}</p>
                  <p>{c.asset_name} · version {c.version} · {c.status}{c.current ? '' : ' (draft)'}</p>
                  <p className="text-[#525252]">{limitsSummary(c.limits).join(' · ')}</p>
                </div>
                <Link to={`/agentChat?asset=${c.asset}&kind=${c.kind}`} className="text-[#0f62fe]">Edit</Link>
              </div>
            ))}
            <Link to="/protected" className="inline-flex min-h-11 items-center text-sm text-[#0f62fe]">View protected boundary</Link>
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
