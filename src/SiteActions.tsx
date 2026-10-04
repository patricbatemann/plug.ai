import { Link, useNavigate } from "react-router"
import { scenarioTime, useOperations } from "./Operations"

const card = "border border-[#e0e0e0] bg-white p-4 md:p-5"
const button =
  "min-h-11 rounded-[2px] border border-[#e0e0e0] px-4 text-xs font-semibold hover:bg-[#f4f4f4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f62fe]"

function Badge({
  children,
  tone = "gray",
}: {
  children: React.ReactNode
  tone?: "blue" | "gray" | "orange" | "red" | "green"
}) {
  const colors = {
    blue: "bg-[#edf5ff] text-[#0f62fe]",
    gray: "bg-[#f4f4f4] text-[#6f6f6f]",
    orange: "bg-[#fff4e5] text-[#8a3800]",
    red: "bg-[#fff1f1] text-[#da1e28]",
    green: "bg-[#defbe6] text-[#198038]",
  }
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${colors[tone]}`}
    >
      {children}
    </span>
  )
}

function Check({
  children,
  state = "done",
}: {
  children: React.ReactNode
  state?: "done" | "active" | "waiting" | "fail"
}) {
  const colors = {
    done: "bg-[#defbe6] text-[#198038]",
    active: "bg-[#edf5ff] text-[#0f62fe]",
    waiting: "bg-[#f4f4f4] text-[#8d8d8d]",
    fail: "bg-[#fff1f1] text-[#da1e28]",
  }
  return (
    <li className="flex items-start gap-3 text-[13px] leading-5">
      <span
        aria-hidden="true"
        className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full text-xs ${colors[state]}`}
      >
        {state === "done"
          ? "✓"
          : state === "active"
            ? "•"
            : state === "fail"
              ? "×"
              : "–"}
      </span>
      <span>{children}</span>
    </li>
  )
}

export default function SiteActions({
  onLiveOverview,
}: {
  onLiveOverview?: () => void
}) {
  const operations = useOperations()
  const { state, flow } = operations
  const navigate = useNavigate()
  const paused = state.batteryPaused
  const setPaused = () => operations.toggleBatteryPause()
  const decision = state.approval?.decision

  return (
    <main className="w-full min-w-0 space-y-8 px-4 py-8 text-[#525252] md:px-8 xl:px-12 font-['IBM Plex Sans:Regular']">
      <p className="text-xs text-[#6f6f6f]">
        Preview snapshot · {flow.timestamp} · No equipment commands are sent.
      </p>
      <section aria-labelledby="executing-title">
        {!state.activated && <p className="mb-4 text-xs">Existing site battery dispatch is shown below. The new BOB action is {state.stage}; it is not active until activation is confirmed.</p>}
        <div className="mb-4 flex flex-wrap items-center gap-3 border-b-2 border-[#0f62fe] pb-1">
          <h2
            id="executing-title"
            className="text-xl font-semibold text-[#161616]"
          >
            Currently Executing
          </h2>
          <Badge tone={flow.completed ? "green" : paused ? "gray" : state.activated ? "blue" : "gray"}>
            {flow.completed ? "Completed" : paused ? "1 Paused" : state.activated ? "1 Active" : "Baseline Dispatch (Pre-activation)"}
          </Badge>
        </div>
        <div className={card}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-[#161616]">
                Battery Discharge 6 MW
              </h3>
              <p className="text-xs">Kuppam Solar Site · Battery 1</p>
            </div>
            <Badge tone={flow.completed ? "green" : paused ? "gray" : state.activated ? "blue" : "gray"}>
              {flow.completed ? "Completed" : paused ? "Active" : state.activated ? "Executing" : "Baseline"}
            </Badge>
          </div>
          <div
            role="progressbar"
            aria-label="Battery discharge duration"
            aria-valuemin={0}
            aria-valuemax={flow.durationMinutes}
            aria-valuenow={Math.min(flow.elapsedMinutes, flow.durationMinutes)}
            className="mt-4 h-2 overflow-hidden rounded-full bg-[#f4f4f4]"
          >
            <div className={flow.completed ? "h-full bg-[#198038]" : "h-full rounded-full bg-[#0f62fe]"} style={{ width: `${Math.min(100, flow.elapsedMinutes / flow.durationMinutes * 100)}%` }} />
          </div>
          <div className="mt-2 flex flex-wrap justify-between gap-2 text-[11px]">
            <span>Started at 14:32 IST ({flow.elapsedMinutes ? `${flow.elapsedMinutes}m ago` : 'just started'})</span>
            <strong>{flow.energyMWh.toFixed(1)} / {(state.activeConfig?.limits.maxEnergyMWh ?? 3)} MWh discharged</strong>
          </div>
          <ol className="my-5 space-y-2">
            <Check>Initiated — Automated threshold trigger</Check>
            <Check>Approval verified — Inside autonomous limit policy</Check>
            <Check>Discharge started — Simulated preview; no hardware commands sent</Check>
            <Check state={paused ? "waiting" : "active"}>
              <strong>
                {paused
                  ? "Task paused — Preview only"
                  : flow.completed ? "Completed — Configured action limit reached" : "Monitoring output — Preview telemetry; live SCADA adapter required"}
              </strong>
            </Check>
            <Check state="waiting">Completion &amp; report generation</Check>
          </ol>
          <dl className="grid grid-cols-2 gap-4 rounded bg-[#f4f4f4] p-3 sm:grid-cols-4">
            {[
              ["Current output", `${flow.battery} MW`],
              ["Battery SOC", `${flow.soc}%`],
              ["Grid demand", `${flow.demand} MW`],
              ["Est. completion", paused ? "Held" : scenarioTime(flow.durationMinutes).split(", ")[1]],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-[10px] uppercase text-[#6f6f6f]">
                  {label}
                </dt>
                <dd className="text-xs font-semibold text-[#161616]">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex flex-wrap justify-end gap-3">
            <button disabled={!state.activated} className={button} onClick={() => setPaused()}>
              {paused ? "Resume Task" : "Pause Task"}
            </button>
            <button
              className={`${button} border-[#0f62fe] bg-[#0f62fe] text-white hover:bg-[#0353e9]`}
              onClick={onLiveOverview}
            >
              View Live Chart
            </button>
          </div>
        </div>
      </section>
      <section aria-labelledby="approval-title">
        <div className="mb-4 flex flex-wrap items-center gap-3 border-b border-[#ff832b] pb-1"><h2 id="approval-title" className="text-xl font-semibold text-[#161616]">Pending Approval</h2><Badge tone="orange">{decision === 'pending' ? '1 Required' : '0 Required'}</Badge></div>
        <div className={card}>{state.approval ? <><div className="flex flex-wrap justify-between gap-3"><h3 className="text-sm font-semibold text-[#161616]">Import {state.approval.mw} MW from Grid · Kuppam Solar Site · Grid Tie</h3><Badge tone="orange">{operations.approvalState}</Badge></div><p className="my-4 text-xs leading-5">Demand: {flow.demand} MW. Solar: 38 MW. Battery: {flow.battery} MW. Actual grid import: {flow.grid} MW. Remaining deficit: {flow.deficit} MW. Proposed import: 8 MW for 15 minutes. Administrator approval expires after 10 minutes.</p><div className="flex flex-wrap justify-end gap-3"><Link to="/audit" className="inline-flex min-h-11 items-center px-4 text-xs text-[#0f62fe]">View evidence</Link><button className={button} onClick={() => navigate('/approval')}>Review approval</button>{['rejected','expired'].includes(decision ?? '') && <button className={button} onClick={operations.requestImport}>Request fresh approval</button>}</div></> : <><p className="text-sm">No approval requests at {flow.timestamp}.</p><button className={button + ' mt-4'} onClick={operations.requestImport}>Preview 14:50 demand spike</button></>}</div>
      </section>
      <section aria-labelledby="waiting-title">
        <div className="mb-4 flex flex-wrap items-center gap-3 border-b border-[#ff832b] pb-1">
          <h2
            id="waiting-title"
            className="text-xl font-semibold text-[#161616]"
          >
            Waiting Actions
          </h2>
          <Badge>3 Watching</Badge>
        </div>
        <div className="space-y-4">
          <Watch
            title="Auto-Sell Surplus Energy"
            asset="Grid Tie"
            note="1 of 3 conditions not met — Waiting for surplus to reach threshold"
            history="Last triggered: 45 min ago — Sold 12 MWh at ₹8.40/kWh"
          >
            <Check state="fail">
              Surplus generation &gt; 5 MW{" "}
              <strong className="text-[#da1e28]">0 MW</strong>
            </Check>
            <Check>
              Market price &gt; ₹8.00/kWh{" "}
              <strong className="text-[#198038]">₹8.40/kWh</strong>
            </Check>
            <Check>
              Grid stability &gt; 95%{" "}
              <strong className="text-[#198038]">97.2%</strong>
            </Check>
          </Watch>
          <Watch
            title="Preventive Maintenance Alerts"
            asset="Inverter 01"
            note="All equipment operating within normal parameters"
            history="Last triggered: 2 hours ago — Created WO-4521 for panel cleaning"
          >
            <Check state="waiting">
              Inverter efficiency &lt; 92% <strong>94.8%</strong>
            </Check>
            <Check state="waiting">
              Vibration anomaly detected <strong>Normal</strong>
            </Check>
          </Watch>
          <Watch
            title="Grid Import on Shortfall"
            asset="Grid Tie"
            note={state.spike ? `Grid recommendation: ${decision ?? "not requested"}` : "Monitoring — No import required at 14:32 IST"}
            history={state.spike ? "Last triggered: 14:50 IST — Import 8 MW recommended" : "Not triggered in this snapshot"}
          >
            <Check state="active">
              Demand exceeds available solar and battery supply —{" "}
              <strong>{flow.deficit} MW deficit</strong>
            </Check>
          </Watch>
        </div>
      </section>
    </main>
  )
}

function Watch({
  title,
  asset,
  note,
  history,
  children,
}: {
  title: string
  asset: string
  note: string
  history: string
  children: React.ReactNode
}) {
  return (
    <article className={card}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[#161616]">{title}</h3>
          <p className="text-xs">Kuppam Solar Site · {asset}</p>
        </div>
        <Badge>Watching</Badge>
      </div>
      <ul className="my-4 space-y-2">{children}</ul>
      <div className="flex flex-wrap justify-between gap-3 text-xs text-[#6f6f6f]">
        <p>{note}</p>
        <p>{history}</p>
      </div>
    </article>
  )
}
