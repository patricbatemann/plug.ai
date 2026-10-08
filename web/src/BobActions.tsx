import { useState } from "react"
import { useNavigate } from "react-router"
import { useOperations } from "./Operations"
import { useProfile } from "./auth/user"
import { STATE_COLOR, type ActionState } from "./data"
import { DEFAULT_CONFIG } from './ActionConfig'

import { getActionTemplates } from "./services/actionService"

export const BOB_ACTION_TEMPLATES = getActionTemplates()


const actions = BOB_ACTION_TEMPLATES
const control =
  "min-h-11 border border-[#8d8d8d] px-4 text-xs hover:bg-[#f4f4f4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f62fe]"

export default function BobActions({
  onClose,
  onAddAction,
}: {
  onClose: () => void
  onAddAction: () => void
}) {
  const operations = useOperations()
  const navigate = useNavigate()
  const { state } = operations
  const paused = new Set(state.batteryPaused ? ['battery'] : [])
  const activeCount = state.activated && !state.batteryPaused && !operations.flow.completed ? 1 : 0
  const actionStatus = (id: string) => {
    if (id === 'battery') {
      if (!state.activated) return state.stage; // Draft, Configuring, Ready to test, Testing, Tested, Ready to activate
      if (state.batteryPaused) return 'Active';
      if (operations.flow.completed) return 'Completed';
      return state.stage === 'Executing' ? 'Executing' : 'Active';
    }
    if (id === 'grid' && state.approval) {
      if (state.approval.decision === 'pending') return 'Awaiting approval';
      if (state.approval.decision === 'approved') return state.approval.executable ? 'Executing' : 'Failed';
      if (state.approval.decision === 'rejected') return 'Rejected';
      if (state.approval.decision === 'expired') return 'Expired';
    }
    return 'Draft';
  };
  const editAction = (id: string) => { if (id === 'battery') { operations.edit(0); onAddAction(); } else navigate('/actionTemplate?template=' + id); }
  const addAction = () => { if (state.activated && ['Active','Executing','Completed'].includes(state.stage)) operations.setState(current => ({ ...current, config: structuredClone(DEFAULT_CONFIG), stage: 'Draft', started: false, confirmed: [], step: 0, tests: {}, testKey: '' })); onAddAction(); }

  const profile = useProfile()
  const [expanded, setExpanded] = useState(new Set(["sell", "battery"]))
  const [filter, setFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState("modified")
  const [history, setHistory] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<string | null>(null)

  const handleSaveDetails = (actionId?: string, actionTitle?: string) => {
    const title = actionTitle ?? 'Action configuration'
    operations.addAudit('Action details saved', `${title} saved to site profile by ${profile?.name ?? 'the operator'}.`)
    setSaveStatus(`${title} saved successfully.`)
    setTimeout(() => {
      setSaveStatus(null)
    }, 3500)
  }
  const togglePaused = (id: string) => {
    if (id !== 'battery' || !state.activated) { editAction(id); return; }
    operations.toggleBatteryPause();
  }
  const toggleExpanded = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const shown = actions.filter(
    (action) =>
      action.title.toLowerCase().includes(search.toLowerCase()) &&
      (filter === "all" ||
        (filter === "active" && action.id === "battery" && activeCount === 1) ||
        (filter === "paused" && paused.has(action.id)) || (filter === "attention" && action.id === "grid" && state.approval?.decision === "pending")),
  )
  if (sort === "name") shown.sort((first, second) => first.title.localeCompare(second.title))
  else shown.sort((first, second) => (second.id === "grid" && state.approval ? 3 : second.id === "battery" && state.started ? 2 : 0) - (first.id === "grid" && state.approval ? 3 : first.id === "battery" && state.started ? 2 : 0))
  const selectedHistory = actions.find((action) => action.id === history)

  return (
    <div className="min-h-screen bg-[#f4f4f4] text-[#525252] font-['IBM Plex Sans:Regular']">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e0e0e0] bg-white px-4 py-3 md:px-6">
        <nav
          aria-label="Site navigation"
          className="flex flex-wrap items-center gap-6 text-sm"
        >
          <strong className="flex items-center gap-2 text-[#161616]">
            <span className="size-6 rounded-full bg-[#0f62fe]" />
            Kuppam Solar
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
          <span>Settings</span>
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
            KUP-SOLAR-001
          </button>
          <span>/</span>
          <span>BOB</span>
        </nav>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-[32px] font-light text-[#161616]">
            Configure BOB
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => handleSaveDetails(undefined, 'All BOB action details')}
              className="flex min-h-11 items-center gap-2 rounded-[2px] border border-[#0f62fe] bg-white px-4 text-sm font-semibold text-[#0f62fe] hover:bg-[#edf5ff] transition-colors cursor-pointer"
            >
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              Save details
            </button>
            <button
              onClick={addAction}
              className="flex min-h-11 items-center gap-4 bg-[#0f62fe] px-4 text-sm text-white hover:bg-[#0043ce] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f62fe] cursor-pointer"
            >
              Add new action{" "}
              <span aria-hidden="true" className="text-xl">
                +
              </span>
            </button>
          </div>
        </div>
        <p className="text-sm">
          Manage BOB’s automated actions, triggers, safety limits, and
          permissions for Kuppam Solar Site
        </p>
        <p className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
          <span>
            Configured actions{" "}
            <strong className="ml-2 text-[#161616]">{state.started || state.activated ? 1 : 0}</strong>
          </span>
          <span>
            · Active <strong>{activeCount}</strong>
          </span>
          <span>
            · Paused <strong>{paused.size}</strong>
          </span>
          <span>
            · Saved templates <strong>4</strong> · Last modified <strong className="font-mono">{operations.flow.timestamp}</strong>
          </span>
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e0e0e0] bg-white px-4 py-3 md:px-8 xl:px-12">
        <div
          className="flex max-w-full gap-2 overflow-x-auto"
          aria-label="Filter actions"
        >
          {[
            ["all", `All (5)`],
            ["active", `Active (${activeCount})`],
            ["paused", `Paused (${paused.size})`],
            ["attention", `Needs attention (${state.approval?.decision === "pending" ? 1 : 0})`],
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
            <option value="modified">Sort by: Last modified</option>
            <option value="name">Sort by: Name</option>
          </select>
        </div>
      </div>
      <main className="space-y-4 px-4 py-6 md:px-8 xl:px-12">
        <p className="text-xs">
          Preview action library · Only Battery 1 can be activated through the current simulation journey. Other cards are draft templates. Activity below is historical preview evidence, not new executions.
        </p>
        {shown.length === 0 && (
          <p
            role="status"
            className="border border-[#e0e0e0] bg-white p-8 text-center"
          >
            No actions match this view.
          </p>
        )}
        {shown.map((action) => (
          <article key={action.id} className="border border-[#e0e0e0] bg-white">
            <div
              className={`flex items-center gap-3 p-4 md:p-5 ${
                expanded.has(action.id) ? "bg-[#edf5ff]" : ""
              }`}
            >
              <button
                role="switch"
                disabled={action.id !== "battery" || !state.activated}
                aria-checked={action.id === "battery" && activeCount === 1}
                aria-label={`${action.title} enabled in preview`}
                onClick={() => togglePaused(action.id)}
                className="flex min-h-11 min-w-11 shrink-0 items-center justify-center"
              >
                <span
                  className={`flex h-5 w-9 items-center rounded-full p-0.5 ${
                    action.id === "battery" && activeCount === 1 ? "bg-[#0f62fe]" : "bg-[#8d8d8d]"
                  }`}
                >
                  <span
                    className={`size-4 rounded-full bg-white ${
                      action.id === "battery" && activeCount === 1 ? "ml-auto" : ""
                    }`}
                  />
                </span>
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-sm font-semibold text-[#161616]">
                    {action.title}
                  </h2>
                  <span className="px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: STATE_COLOR[actionStatus(action.id) as ActionState].bg, color: STATE_COLOR[actionStatus(action.id) as ActionState].text }}>{actionStatus(action.id)}</span>
                </div>
                <p className="mt-1 text-xs leading-5">{action.description}</p>
              </div>
              <span className="hidden shrink-0 rounded-[2px] bg-[#f4f4f4] px-3 py-1 text-xs font-mono sm:block">
                {action.count} today
              </span>
              <button
                aria-label={`${
                  expanded.has(action.id) ? "Collapse" : "Expand"
                } ${action.title}`}
                aria-expanded={expanded.has(action.id)}
                aria-controls={`details-${action.id}`}
                onClick={() => toggleExpanded(action.id)}
                className="min-h-11 min-w-11 text-xl"
              >
                {expanded.has(action.id) ? "⌃" : "⌄"}
              </button>
            </div>
            {expanded.has(action.id) && (
              <div
                id={`details-${action.id}`}
                className="space-y-6 border-t border-[#e0e0e0] p-4 md:p-5"
              >
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <h3 className="mb-3 text-[11px] font-semibold uppercase text-[#6f6f6f]">
                      Trigger conditions
                    </h3>
                    <ul className="space-y-2">
                      {(action.id === "battery" && state.started ? [`Pre-battery deficit > ${(state.activeConfig ?? state.config).trigger.deficitMW} MW for ${(state.activeConfig ?? state.config).trigger.delayMin} minutes`, "SOC above 60% to start; fresh telemetry and safety checks required", `Stop at ${(state.activeConfig ?? state.config).limits.reserveSOC}% reserve`] : action.triggers).map((trigger) => (
                        <li
                          key={trigger}
                          className="flex gap-3 text-xs leading-5"
                        >
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
                      Execution rules · {action.id === "battery" && state.activated ? "Effective policy" : "Proposed configuration"}
                    </h3>
                    <ul className="space-y-2 text-xs leading-5">
                      {(action.id === "battery" && state.started ? [`Automatic limit ${(state.activeConfig ?? state.config).limits.autoMaxMW} MW; 8 MW equipment maximum`, `Reserve ${(state.activeConfig ?? state.config).limits.reserveSOC}%; locked emergency floor 30%`, `Cap ${(state.activeConfig ?? state.config).limits.maxDuration} minutes / ${(state.activeConfig ?? state.config).limits.maxEnergyMWh} MWh`, "Above 6 MW: administrator approval; expires after 10 minutes", `Recovery: ${(state.activeConfig ?? state.config).recovery}`, `Notify: ${(state.activeConfig ?? state.config).notifications.join(", ")}`] : action.rules).map((rule) => (
                        <li key={rule}>{rule}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div>
                  <h3 className="mb-3 text-[11px] font-semibold uppercase text-[#6f6f6f]">
                    Recent activity · Historical preview evidence
                  </h3>
                  <Activity rows={action.activity} />
                </div>
                <div>
                  <h3 className="mb-2 text-[11px] font-semibold uppercase text-[#6f6f6f]">
                    Performance summary
                  </h3>
                  <p className="border border-[#e0e0e0] bg-[#f4f4f4] p-3 text-xs leading-5">
                    {action.summary}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e0e0e0] pt-4">
                  <div className="flex flex-wrap gap-2 items-center">
                    <button className={control} onClick={() => editAction(action.id)}>
                      Edit Action
                    </button>
                    <button
                      disabled={action.id !== "battery" || !state.activated} className={control}
                      onClick={() => togglePaused(action.id)}
                    >
                      {paused.has(action.id) ? "Resume" : "Pause"}
                    </button>
                  </div>
                  <button
                    onClick={() =>
                      setHistory(history === action.id ? null : action.id)
                    }
                    className="min-h-11 text-xs font-semibold text-[#0f62fe] underline hover:text-[#0043ce] cursor-pointer"
                  >
                    {history === action.id
                      ? "Hide Full History"
                      : "View Full History"}
                  </button>
                </div>
                {selectedHistory?.id === action.id && (
                  <section
                    aria-label={`${action.title} full history`}
                    className="border-t border-[#e0e0e0] pt-4"
                  >
                    <p className="mb-3 text-xs">
                      Available preview audit records — full history requires a
                      connected API.
                    </p>
                    <Activity rows={action.activity} />
                  </section>
                )}
              </div>
            )}
          </article>
        ))}
      </main>
      <footer className="flex flex-wrap justify-between gap-3 border-t border-[#e0e0e0] bg-white px-4 py-5 text-xs md:px-8 xl:px-12">
        <span>Showing {shown.length} of 5 actions</span>
        <span className="font-mono">KUP-SOLAR-001 Site ID: KUP-SOLAR-001</span>
      </footer>

      {saveStatus && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-[2px] bg-[#198038] px-4 py-3 text-sm text-white shadow-lg transition-all animate-pulse"
        >
          <svg className="size-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span className="font-medium">{saveStatus}</span>
          <button
            onClick={() => setSaveStatus(null)}
            className="ml-2 text-white/80 hover:text-white cursor-pointer"
            aria-label="Close message"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}

function Activity({ rows }: { rows: string[][] }) {
  return (
    <ul>
      {rows.map(([time, text, status]) => (
        <li
          key={`${time}-${text}`}
          className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e0e0e0] px-3 py-3 text-xs last:border-0"
        >
          <p className="min-w-0 leading-5">
            <strong className="text-[#161616] font-mono">{time}</strong> — {text}
          </p>
          <span
            className={`px-2 py-1 font-semibold ${
              status === "Completed"
                ? "bg-[#defbe6] text-[#198038]"
                : "bg-[#f4f4f4]"
            }`}
          >
            {status}
          </span>
        </li>
      ))}
    </ul>
  )
}
