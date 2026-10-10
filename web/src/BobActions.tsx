import { useState } from "react"
import { Link } from "react-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { configApi, runApi, type ActionOut, type ConfigOut } from "./api/client"
import { useProfile } from "./auth/user"
import { SITE } from "./data"
import { AUTONOMY, actionLabel, configKindLabel, limitsSummary, mw, simTime, statusOf, watchLabel } from "./format"
import { useCurrentRun } from "./runs/useCurrentRun"
import { useSite } from "./site"

const control =
  "min-h-11 border border-[#8d8d8d] px-4 text-xs hover:bg-[#f4f4f4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f62fe] disabled:cursor-not-allowed disabled:opacity-50"

const STATUS_TAG: Record<ConfigOut["status"], string> = {
  active: "bg-[#defbe6] text-[#198038]",
  paused: "bg-[#f4f4f4] text-[#525252]",
  testing: "bg-[#edf5ff] text-[#0f62fe]",
  draft: "bg-[#f4f4f4] text-[#525252]",
}

const triggers = (c: ConfigOut, names: Record<string, string>) =>
  c.watch.length
    ? c.watch.map((w) => `BOB re-plans when ${watchLabel(w, c.asset_name, names)}`)
    : ["Whenever BOB's plan calls for this action"]

const rules = (c: ConfigOut) => [
  AUTONOMY[c.autonomy].label,
  ...limitsSummary(c.limits),
  `Approver: ${c.approval.approver ?? "Site operator"}, within ${c.approval.response_min ?? 10} minutes`,
]

export default function BobActions({
  onClose,
  onAddAction,
}: {
  onClose: () => void
  onAddAction: () => void
}) {
  const profile = useProfile()
  const { siteName, info } = useSite()
  const names = Object.fromEntries((info?.assets ?? []).map((a) => [a.code, a.name]))
  const queryClient = useQueryClient()
  const run = useCurrentRun().data
  const configs = useQuery({ queryKey: ["configs", SITE.id], queryFn: () => configApi.list(SITE.id) }).data ?? []
  const recent = useQuery({
    queryKey: ["actions", run?.id, run?.block, SITE.id],
    queryFn: () => runApi.actions(run!.id, { site: SITE.id, limit: 100 }),
    enabled: !!run,
  }).data ?? []
  const [expanded, setExpanded] = useState(new Set<number>())
  const [filter, setFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState("modified")
  const [history, setHistory] = useState<number | null>(null)
  const [error, setError] = useState("")

  const activity = (c: ConfigOut) => recent.filter((a) => a.family === c.kind && a.asset === c.asset_name)
  const pending = (c: ConfigOut) => activity(c).filter((a) => a.status === "awaiting_approval").length
  const togglePaused = async (c: ConfigOut) => {
    setError("")
    try {
      await configApi.setStatus(c.id, c.status === "active" ? "paused" : "active")
      await queryClient.invalidateQueries({ queryKey: ["configs", SITE.id] })
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The change was not saved.")
    }
  }
  const toggleExpanded = (id: number) =>
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const active = configs.filter((c) => c.status === "active")
  const paused = configs.filter((c) => c.status === "paused")
  const attention = configs.filter((c) => pending(c) > 0)
  const shown = configs.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) &&
      (filter === "all" ||
        (filter === "active" && c.status === "active") ||
        (filter === "paused" && c.status === "paused") ||
        (filter === "attention" && pending(c) > 0)),
  )
  if (sort === "name") shown.sort((first, second) => first.name.localeCompare(second.name))
  else shown.sort((first, second) => second.actions_today - first.actions_today)

  return (
    <div className="min-h-screen bg-[#f4f4f4] text-[#525252] font-['IBM Plex Sans:Regular']">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e0e0e0] bg-white px-4 py-3 md:px-6">
        <nav
          aria-label="Site navigation"
          className="flex flex-wrap items-center gap-6 text-sm"
        >
          <strong className="flex items-center gap-2 text-[#161616]">
            <span className="size-6 rounded-full bg-[#0f62fe]" />
            {siteName}
          </strong>
          <button className="min-h-11" onClick={onClose}>
            Site
          </button>
          <span
            aria-current="page"
            className="border-b-2 border-[#0f62fe] py-3 font-semibold text-[#0f62fe]"
          >
            BOB
          </span>
        </nav>
        <div className="flex items-center gap-2 text-xs">
          <span className="flex size-8 items-center justify-center rounded-full bg-[#0f62fe] text-white">
            {profile?.initials}
          </span>
          {profile?.name}
        </div>
      </header>
      <div className="space-y-5 border-b border-[#e0e0e0] bg-white px-4 py-6 md:px-8 xl:px-12">
        <nav aria-label="Breadcrumb" className="flex gap-3 text-xs">
          <button onClick={onClose} className="text-[#0f62fe] hover:underline">
            Sites
          </button>
          <span>/</span>
          <button onClick={onClose} className="text-[#0f62fe] hover:underline">
            {SITE.id}
          </button>
          <span>/</span>
          <span>BOB</span>
        </nav>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-[32px] font-light text-[#161616]">
            Configure BOB
          </h1>
          <button
            onClick={onAddAction}
            className="flex min-h-11 items-center gap-4 bg-[#0f62fe] px-4 text-sm text-white hover:bg-[#0043ce] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f62fe] cursor-pointer"
          >
            Add new action{" "}
            <span aria-hidden="true" className="text-xl">
              +
            </span>
          </button>
        </div>
        <p className="text-sm">
          Manage BOB’s automated actions, triggers, safety limits, and
          permissions for {siteName}
        </p>
        <p className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
          <span>
            Configured actions{" "}
            <strong className="ml-2 text-[#161616]">{configs.length}</strong>
          </span>
          <span>
            · Active <strong>{active.length}</strong>
          </span>
          <span>
            · Paused <strong>{paused.length}</strong>
          </span>
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e0e0e0] bg-white px-4 py-3 md:px-8 xl:px-12">
        <div
          className="flex max-w-full gap-2 overflow-x-auto"
          aria-label="Filter actions"
        >
          {[
            ["all", `All (${configs.length})`],
            ["active", `Active (${active.length})`],
            ["paused", `Paused (${paused.length})`],
            ["attention", `Needs attention (${attention.length})`],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              aria-pressed={filter === id}
              className={`min-h-11 shrink-0 px-3 text-sm ${
                filter === id
                  ? "bg-[#edf5ff] font-semibold text-[#0f62fe]"
                  : "hover:bg-[#f4f4f4]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex w-full flex-wrap gap-3 sm:w-auto">
          <input
            aria-label="Search actions"
            placeholder="Search actions..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="min-h-11 min-w-0 flex-1 border border-[#e0e0e0] bg-[#f4f4f4] px-3 text-sm"
          />
          <select
            aria-label="Sort actions"
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            className="min-h-11 max-w-full border border-[#e0e0e0] bg-white px-3 text-sm"
          >
            <option value="modified">Sort by: Most used today</option>
            <option value="name">Sort by: Name</option>
          </select>
        </div>
      </div>
      <main className="space-y-4 px-4 py-6 md:px-8 xl:px-12">
        {error && <p role="alert" className="border-l-4 border-[#da1e28] bg-[#fff1f1] p-4 text-sm text-[#161616]">{error}</p>}
        {shown.length === 0 && (
          <p
            role="status"
            className="border border-[#e0e0e0] bg-white p-8 text-center"
          >
            No actions match this view.
          </p>
        )}
        {shown.map((c) => (
          <article key={c.id} className="border border-[#e0e0e0] bg-white">
            <div
              className={`flex items-center gap-3 p-4 md:p-5 ${
                expanded.has(c.id) ? "bg-[#edf5ff]" : ""
              }`}
            >
              <button
                role="switch"
                disabled={c.status !== "active" && c.status !== "paused"}
                aria-checked={c.status === "active"}
                aria-label={`${c.name} enabled`}
                onClick={() => togglePaused(c)}
                className="flex min-h-11 min-w-11 shrink-0 items-center justify-center"
              >
                <span
                  className={`flex h-5 w-9 items-center rounded-full p-0.5 ${
                    c.status === "active" ? "bg-[#0f62fe]" : "bg-[#8d8d8d]"
                  }`}
                >
                  <span
                    className={`size-4 rounded-full bg-white ${
                      c.status === "active" ? "ml-auto" : ""
                    }`}
                  />
                </span>
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-sm font-semibold text-[#161616]">
                    {c.name}
                  </h2>
                  <span className={`px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_TAG[c.status]}`}>{c.status}</span>
                  {pending(c) > 0 && <span className="bg-[#fef3c7] px-2 py-0.5 text-xs font-semibold text-[#b26207]">{pending(c)} awaiting approval</span>}
                </div>
                <p className="mt-1 text-xs leading-5">{configKindLabel(c.kind)} · {c.asset_name} · version {c.version}</p>
              </div>
              <span className="hidden shrink-0 rounded-[2px] bg-[#f4f4f4] px-3 py-1 text-xs font-mono sm:block">
                {c.actions_today} today
              </span>
              <button
                aria-label={`${expanded.has(c.id) ? "Collapse" : "Expand"} ${c.name}`}
                aria-expanded={expanded.has(c.id)}
                aria-controls={`details-${c.id}`}
                onClick={() => toggleExpanded(c.id)}
                className="min-h-11 min-w-11 text-xl"
              >
                {expanded.has(c.id) ? "⌃" : "⌄"}
              </button>
            </div>
            {expanded.has(c.id) && (
              <div
                id={`details-${c.id}`}
                className="space-y-6 border-t border-[#e0e0e0] p-4 md:p-5"
              >
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <h3 className="mb-3 text-[11px] font-semibold uppercase text-[#6f6f6f]">
                      Trigger conditions
                    </h3>
                    <ul className="space-y-2">
                      {triggers(c, names).map((trigger) => (
                        <li key={trigger} className="flex gap-3 text-xs leading-5">
                          <span aria-hidden="true" className="text-[#198038]">
                            ✓
                          </span>
                          {trigger}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="mb-3 text-[11px] font-semibold uppercase text-[#6f6f6f]">
                      Execution rules · {c.status === "active" ? "Effective policy" : "Configuration"}
                    </h3>
                    <ul className="space-y-2 text-xs leading-5">
                      {rules(c).map((rule) => (
                        <li key={rule}>{rule}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div>
                  <h3 className="mb-3 text-[11px] font-semibold uppercase text-[#6f6f6f]">
                    Recent activity
                  </h3>
                  <Activity rows={activity(c).slice(0, 3)} />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e0e0e0] pt-4">
                  <div className="flex flex-wrap gap-2 items-center">
                    <Link className={`${control} inline-flex items-center`} to={`/agentChat?asset=${c.asset}&kind=${c.kind}`}>
                      Edit Action
                    </Link>
                    <button
                      disabled={c.status !== "active" && c.status !== "paused"}
                      className={control}
                      onClick={() => togglePaused(c)}
                    >
                      {c.status === "paused" ? "Resume" : "Pause"}
                    </button>
                  </div>
                  <button
                    onClick={() => setHistory(history === c.id ? null : c.id)}
                    className="min-h-11 text-xs font-semibold text-[#0f62fe] underline hover:text-[#0043ce] cursor-pointer"
                  >
                    {history === c.id ? "Hide Full History" : "View Full History"}
                  </button>
                </div>
                {history === c.id && (
                  <section
                    aria-label={`${c.name} full history`}
                    className="border-t border-[#e0e0e0] pt-4"
                  >
                    <Activity rows={activity(c)} />
                  </section>
                )}
              </div>
            )}
          </article>
        ))}
      </main>
      <footer className="flex flex-wrap justify-between gap-3 border-t border-[#e0e0e0] bg-white px-4 py-5 text-xs md:px-8 xl:px-12">
        <span>Showing {shown.length} of {configs.length} actions</span>
        <span className="font-mono">Site ID: {SITE.id}</span>
      </footer>
    </div>
  )
}

function Activity({ rows }: { rows: ActionOut[] }) {
  if (!rows.length) return <p className="text-xs">No actions yet in this run.</p>
  return (
    <ul>
      {rows.map((a) => (
        <li
          key={a.id}
          className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e0e0e0] px-3 py-3 text-xs last:border-0"
        >
          <p className="min-w-0 leading-5">
            <strong className="text-[#161616] font-mono">{simTime(a.time)} IST</strong> — {actionLabel(a.kind, a.mw)} {mw(Math.abs(a.mw))}
            {a.reason ? ` · ${a.reason}` : ""}
          </p>
          <span
            className={`px-2 py-1 font-semibold ${
              a.status === "verified" ? "bg-[#defbe6] text-[#198038]" : "bg-[#f4f4f4]"
            }`}
          >
            {statusOf(a.status).label}
          </span>
        </li>
      ))}
    </ul>
  )
}
