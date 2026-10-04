import { useEffect, useRef, useState, type ReactNode } from "react"
import {
  REQUIRED_SIMULATIONS,
  BATTERY_POLICY,
  SITE,
  SNAPSHOT_14_32,
  SNAPSHOT_14_50,
} from "./data"
import type { ActionConfig } from "./AgentChat"
import { policyErrors, useOperations } from './Operations'
import { evaluateBattery, type BatteryInputs } from './BatteryEvaluation'

interface TestSimulationProps {
  config: ActionConfig
  onBack: () => void
  onComplete: () => void
  onConfigure?: () => void
  onConnectData?: () => void
  onExit?: () => void
}

type TestStatus = "pending" | "running" | "passed" | "failed"
interface ScenarioInputs {
  solar: number
  demand: number
  soc: number
  temperature: number
}
interface TestResult {
  status: TestStatus
  detail: string
  checks: string[]
  durationMs?: number
}
interface TestSession {
  results: Record<string, TestResult>
  selected: string
  inputs: ScenarioInputs
}

const sessions = new Map<string, TestSession>()
try {
  const saved = JSON.parse(localStorage.getItem('plug-simulation-sessions-v2') || '[]')
  for (const [key, session] of saved) sessions.set(key, { ...session, results: Object.fromEntries(Object.entries(session.results).map(([id, result]) => [id, (result as TestResult).status === 'running' ? { status: 'pending', detail: 'Interrupted; rerun this scenario.', checks: [] } : result])) })
} catch {}
function saveSession(key: string, session: TestSession) {
  sessions.set(key, session)
  try { localStorage.setItem('plug-simulation-sessions-v2', JSON.stringify([...sessions].slice(-10))) } catch {}
}
const initialInputs: ScenarioInputs = {
  solar: 38,
  demand: 44,
  soc: 72,
  temperature: 42,
}
const scenarioNames: Record<string, string> = {
  normal: "Current site conditions",
  blocked_soc: "Low battery charge",
  stop_reserve: "Configured reserve reached",
  high_temp: "High battery temperature",
  stale_telem: "Delayed battery data",
  unavailable: "Battery unavailable",
  above_limit: "Higher site demand",
}
const objectiveNames: Record<string, string> = {
  reliability: "Maintain supply reliability",
  cost: "Reduce grid purchase cost",
  peak: "Avoid peak grid demand",
  renewable: "Maximize renewable energy use",
}

function Badge({
  children,
  status = "pending",
}: {
  children: ReactNode
  status?: TestStatus | "info"
}) {
  const colors =
    status === "passed"
      ? "bg-[#defbe6] text-[#0e6027]"
      : status === "failed"
        ? "bg-[#fff1f1] text-[#a2191f]"
        : status === "running" || status === "info"
          ? "bg-[#edf5ff] text-[#0043ce]"
          : "bg-[#f4f4f4] text-[#525252]"
  return (
    <span
      className={`inline-flex w-fit shrink-0 items-center px-2 py-1 text-[11px] font-medium ${colors}`}
    >
      {children}
    </span>
  )
}

function Section({
  title,
  badge,
  children,
}: {
  title: string
  badge?: string
  children: ReactNode
}) {
  return (
    <section className="border border-[#e0e0e0] bg-white p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#e0e0e0] pb-3">
        <h2 className="text-[15px] font-semibold text-[#161616]">{title}</h2>
        {badge && <Badge status="info">{badge}</Badge>}
      </div>
      {children}
    </section>
  )
}

function DataRows({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <dl className="flex flex-col divide-y divide-[#e0e0e0]">
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="grid grid-cols-1 gap-1 py-2.5 text-[13px] sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] sm:gap-4"
        >
          <dt className="text-[#525252]">{label}</dt>
          <dd className="min-w-0 font-medium text-[#161616] sm:text-right">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function evaluateScenario(
  id: string,
  config: ActionConfig,
  inputs: ScenarioInputs,
): TestResult {
  const policyChecks: Array<[boolean, string]> = [
    [
      Number.isFinite(config.limits.autoMaxMW) &&
        config.limits.autoMaxMW > 0 &&
        config.limits.autoMaxMW <= 6,
      "Automatic discharge is capped at 6 MW",
    ],
    [
      Number.isFinite(config.limits.reserveSOC) &&
        config.limits.reserveSOC >= 55 &&
        config.limits.reserveSOC <= 100,
      "Configured reserve protects at least 55% SOC; 30% emergency floor stays locked",
    ],
    [
      Number.isFinite(config.limits.maxDuration) &&
        config.limits.maxDuration > 0 &&
        config.limits.maxDuration <= 30,
      "Each action lasts no more than 30 minutes",
    ],
    [
      Number.isFinite(config.limits.maxEnergyMWh) &&
        config.limits.maxEnergyMWh > 0 &&
        config.limits.maxEnergyMWh <= 3,
      "Each action uses no more than 3 MWh",
    ],
    [
      config.automation.approvalAboveMW > 0 &&
        config.automation.approvalAboveMW <= 6 &&
        config.automation.approvalExpiryMin === 10,
      "Requests above 6 MW need approval; approvals expire after 10 minutes",
    ],
    [
      config.trigger.deficitMW >= 3 && config.trigger.delayMin >= 5,
      "Deficit must exceed 3 MW and persist for at least 5 minutes",
    ],
  ]
  const failures = policyChecks
    .filter(([passed]) => !passed)
    .map(([, detail]) => detail)
  failures.push(...policyErrors(config))
  if (failures.length)
    return {
      status: "failed",
      detail:
        "Configuration conflicts with protected site policy. Return to configuration before activation.",
      checks: failures,
    }
  const checks = policyChecks.map(([, detail]) => detail)
  const engineInput: BatteryInputs = { ...inputs, requestedMW: 6, sustainedMinutes: config.trigger.delayMin, elapsedMinutes: 0, energyMWh: 0, telemetrySeconds: 8, available: true, maintenance: false, healthNormal: true, safetyPassed: true, running: false }
  const overrides: Record<string, Partial<BatteryInputs>> = {
    blocked_soc: { soc: 58 }, stop_reserve: { soc: config.limits.reserveSOC, running: true }, high_temp: { temperature: 47 },
    stale_telem: { telemetrySeconds: 121 }, unavailable: { available: false }, above_limit: { requestedMW: 8, demand: 52 },
  }
  const expected: Record<string, string> = { normal: 'executing', blocked_soc: 'blocked', stop_reserve: 'stopped', high_temp: 'blocked', stale_telem: 'blocked', unavailable: 'blocked', above_limit: 'awaiting approval' }
  const evaluated = evaluateBattery(config, { ...engineInput, ...(id === 'normal' ? inputs : initialInputs), ...overrides[id] })
  if (evaluated !== expected[id]) return { status: 'failed', detail: `Policy evaluation returned ${evaluated}; required result is ${expected[id]}.`, checks }
  const details: Record<string, string> = {
    blocked_soc:
      "Action blocked at 58% SOC: charge does not exceed the 60% start threshold. No discharge initiated.",
    stop_reserve: `Discharge stops at the configured ${config.limits.reserveSOC}% reserve. The locked 30% emergency floor is never used as an operating target.`,
    high_temp:
      "Safety blocking passed: discharge is blocked at 47°C, above the 45°C temperature limit.",
    stale_telem:
      "Safety hold passed: telemetry delayed more than 2 minutes blocks execution. Operators are alerted.",
    unavailable:
      config.recovery === "request-import"
        ? "Recovery passed: Battery 1 unavailable → grid-import approval requested. No import executes without approval."
        : "Recovery passed: Battery 1 unavailable → operators notified and the action held. An unavailable backup battery is not dispatched.",
    above_limit:
      "Approval gate passed: an 8 MW discharge request exceeds the 6 MW automatic limit and waits for administrator approval. Equipment maximum remains 8 MW.",
  }
  if (id !== "normal")
    return {
      status: "passed",
      detail: details[id],
      checks: [...checks, details[id]],
    }
  const deficit = inputs.demand - inputs.solar
  if (
    !Object.values(inputs).every(Number.isFinite) ||
    inputs.solar < 0 ||
    inputs.demand < 0 ||
    inputs.soc > 100 ||
    inputs.soc <= Math.max(60, config.limits.reserveSOC) ||
    inputs.temperature > 45 ||
    deficit <= config.trigger.deficitMW ||
    deficit > config.limits.autoMaxMW ||
    deficit > config.automation.approvalAboveMW ||
    config.battery !== "battery1"
  ) {
    return {
      status: "failed",
      detail:
        "This normal-execution scenario cannot safely cover demand. Verify deficit, selected battery, SOC, temperature, and automatic limit, or restore the current site snapshot.",
      checks,
    }
  }
  return {
    status: "passed",
    detail: `After a ${config.trigger.delayMin}-minute sustained deficit, Battery 1 supplies ${deficit} MW. Solar ${inputs.solar} MW + battery ${deficit} MW = demand ${inputs.demand} MW. No grid import is needed.`,
    checks: [
      ...checks,
      "Battery SOC exceeds 60%; telemetry is fresh; Battery 1 is available",
      "Discharge stops at reserve, duration, or energy cap, whichever occurs first",
    ],
  }
}

export default function TestSimulation({
  config,
  onBack,
  onComplete,
  onConfigure = onBack,
  onConnectData = onBack,
  onExit = onBack,
}: TestSimulationProps) {
  const operations = useOperations()
  const configKey = JSON.stringify(config)
  const [session, setSession] = useState<TestSession>(
    () =>
      (operations.state.testKey === configKey ? sessions.get(configKey) : undefined) ?? {
        results: {},
        selected: "normal",
        inputs: { ...initialInputs },
      },
  )
  const [running, setRunning] = useState(false)
  useEffect(() => {
    operations.recordTests(configKey, Object.fromEntries(Object.entries(session.results).map(([id, result]) => [id, result.status])), running)
  }, [configKey, session.results, running])
  const [adjusting, setAdjusting] = useState(false)
  const [draftInputs, setDraftInputs] = useState(session.inputs)
  const execution = useRef<AbortController | null>(null)
  const current = useRef(session)
  const checksRef = useRef<HTMLDetailsElement>(null)

  useEffect(() => {
    const restored = (operations.state.testKey === configKey ? sessions.get(configKey) : undefined) ?? {
      results: {},
      selected: "normal",
      inputs: { ...initialInputs },
    }
    current.current = restored
    setSession(restored)
    setDraftInputs(restored.inputs)
    setRunning(false)
    return () => {
      const interrupted = Boolean(execution.current)
      execution.current?.abort()
      execution.current = null
      const results = Object.fromEntries(
        Object.entries(current.current.results).map(([id, result]) => [
          id,
          result.status === "running"
            ? {
                status: "pending" as TestStatus,
                detail: "Simulation interrupted. Run this scenario again.",
                checks: [],
              }
            : result,
        ]),
      )
      saveSession(configKey, { ...current.current, results })
      if (interrupted) operations.recordTests(configKey, Object.fromEntries(Object.entries(results).map(([id, result]) => [id, result.status])), false)
    }
  }, [configKey])

  const update = (next: TestSession) => {
    current.current = next
    saveSession(configKey, next)
    setSession(next)
  }
  const run = async (ids: string[]) => {
    if (execution.current) return
    const controller = new AbortController()
    execution.current = controller
    setRunning(true)
    for (const id of ids) {
      if (controller.signal.aborted) break
      update({
        ...current.current,
        results: {
          ...current.current.results,
          [id]: {
            status: "running",
            detail: "Checking trigger, permissions, and protected limits…",
            checks: [],
          },
        },
      })
      const started = performance.now()
      await new Promise<void>((resolve) => {
        const finish = () => {
          controller.signal.removeEventListener("abort", cancel)
          resolve()
        }
        const timer = window.setTimeout(finish, 450)
        const cancel = () => {
          window.clearTimeout(timer)
          resolve()
        }
        controller.signal.addEventListener("abort", cancel, { once: true })
      })
      if (controller.signal.aborted) break
      const result = evaluateScenario(id, config, current.current.inputs)
      update({
        ...current.current,
        results: {
          ...current.current.results,
          [id]: {
            ...result,
            durationMs: Math.round(performance.now() - started),
          },
        },
      })
    }
    if (!controller.signal.aborted) {
      execution.current = null
      setRunning(false)
    }
  }

  const passedCount = REQUIRED_SIMULATIONS.filter(
    (scenario) => session.results[scenario.id]?.status === "passed",
  ).length
  const failedCount = REQUIRED_SIMULATIONS.filter(
    (scenario) => session.results[scenario.id]?.status === "failed",
  ).length
  const allPassed = passedCount === REQUIRED_SIMULATIONS.length && !running && !policyErrors(config).length
  const selected = session.selected
  const result = session.results[selected]
  const normal = selected === "normal"
  const inputs = normal
    ? session.inputs
    : {
        ...initialInputs,
        demand: selected === "above_limit" ? 52 : 44,
        soc:
          selected === "blocked_soc"
            ? 58
            : selected === "stop_reserve"
              ? config.limits.reserveSOC
              : 72,
        temperature: selected === "high_temp" ? 47 : 42,
      }
  const deficit = Math.max(0, inputs.demand - inputs.solar)
  const usableMWh = Math.max(
    0,
    ((inputs.soc - config.limits.reserveSOC) / 100) *
      BATTERY_POLICY.totalCapacityMWh,
  )
  const discharge = normal && result?.status === "passed" ? deficit : 0
  const durationMin = discharge
    ? Math.min(
        config.limits.maxDuration,
        (config.limits.maxEnergyMWh / discharge) * 60,
        (usableMWh / discharge) * 60,
      )
    : 0
  const afterSOC =
    inputs.soc -
    ((discharge * durationMin) / 60 / BATTERY_POLICY.totalCapacityMWh) * 100
  const canProceed = () => {
    if (allPassed) onComplete()
  }
  const select = (id: string) => update({ ...current.current, selected: id })

  return (
    <div className="min-h-screen bg-[#f4f4f4] font-['IBM Plex Sans:Regular'] text-[#161616] [&_button]:min-h-11 [&_button]:focus-visible:outline-2 [&_button]:focus-visible:outline-offset-2 [&_button]:focus-visible:outline-[#0f62fe]">
      <header className="border-b border-[#e0e0e0] bg-white px-4 py-3 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center bg-[#0f62fe]">
              <img alt="" src="/assets/71557.svg" className="size-5" />
            </div>
            <h1 className="text-[16px] font-semibold">BOB Agent Setup</h1>
            <select
              aria-label="Selected site"
              value={SITE.id}
              onChange={() => {}}
              className="min-h-11 max-w-full border border-[#e0e0e0] bg-white px-3 text-[13px]"
            >
              <option value={SITE.id}>{SITE.id}</option>
            </select>
            <Badge status={allPassed ? "passed" : "info"}>
              {allPassed ? "Tested" : running ? "Testing" : "Ready to test"}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-[12px]">
            <span className="flex items-center gap-2 text-[#525252]">
              <span className="size-1.5 rounded-full bg-[#24a148]" />3 systems
              connected
            </span>
            <span className="text-[#198038]">
              Draft retained in this session
            </span>
            <button
              onClick={onExit}
              disabled={running}
              className="border border-[#e0e0e0] px-4 hover:bg-[#f4f4f4] disabled:opacity-50"
            >
              Save and exit
            </button>
            <button
              aria-label="Close test screen"
              onClick={onExit}
              disabled={running}
              className="min-w-11 border border-[#e0e0e0] text-lg disabled:opacity-50"
            >
              ×
            </button>
          </div>
        </div>
      </header>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e0e0e0] px-4 py-3 md:px-6">
        <nav
          aria-label="Setup progress"
          className="flex max-w-full items-center gap-3 overflow-x-auto pb-1 text-[12px]"
        >
          {["Select action", "Configure", "Test", "Activate"].map(
            (step, index) => (
              <div
                key={step}
                aria-current={index === 2 ? "step" : undefined}
                className="flex shrink-0 items-center gap-2"
              >
                {index > 0 && <span className="mr-1 h-px w-8 bg-[#e0e0e0]" />}
                <span
                  className={`flex size-5 items-center justify-center rounded-full border text-[10px] ${
                    index === 2
                      ? "border-[#0f62fe] bg-[#0f62fe] text-white"
                      : index < 2
                        ? "border-[#198038] text-[#198038]"
                        : "border-[#8d8d8d] text-[#6f6f6f]"
                  }`}
                >
                  {index < 2 ? "✓" : index + 1}
                </span>
                <span
                  className={
                    index === 2
                      ? "font-semibold text-[#0f62fe]"
                      : "text-[#525252]"
                  }
                >
                  {step}
                </span>
              </div>
            ),
          )}
        </nav>
        <p className="text-[12px] text-[#525252]">
          7 of 7 configuration decisions completed · {passedCount} of 7 required
          scenarios passed
        </p>
      </div>

      <div className="grid min-w-0 lg:grid-cols-[minmax(0,65fr)_minmax(0,35fr)]">
        <main className="min-w-0 p-4 md:p-6">
          <div className="flex flex-col gap-5">
            <Section
              title="Configuration ready for activation safety review"
              badge="7 of 7 settings complete"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-3 text-[12px]">
                <p className="text-[#525252]">
                  {passedCount} of 7 required scenarios passed
                </p>
                <button
                  onClick={onBack}
                  disabled={running}
                  className="text-[#0f62fe] hover:underline disabled:opacity-50"
                >
                  Review configuration · Edit
                </button>
              </div>
              <DataRows
                rows={[
                  [
                    "Objective",
                    objectiveNames[config.objective] ?? config.objective,
                  ],
                  ["Asset", BATTERY_POLICY.name],
                  [
                    "Trigger",
                    `Demand gap >${config.trigger.deficitMW} MW for ${config.trigger.delayMin} min · SOC >60%`,
                  ],
                  [
                    "Max discharge",
                    `${config.limits.autoMaxMW} MW automatic · 8 MW equipment max`,
                  ],
                  ["Max duration", `${config.limits.maxDuration} min`],
                  [
                    "Max energy per action",
                    `${config.limits.maxEnergyMWh} MWh`,
                  ],
                  ["Min reserve", `${config.limits.reserveSOC}%`],
                  [
                    "Automation",
                    config.automation.autoStart
                      ? "Automatic within limits"
                      : "Manual start",
                  ],
                  [
                    "Recovery",
                    config.recovery === "request-import"
                      ? "Battery 1 unavailable → grid-import approval request"
                      : config.recovery,
                  ],
                  [
                    "Notifications",
                    config.notifications.join(" and ") || "None selected",
                  ],
                  ["Protected floor", "Immutable 30% emergency SOC floor"],
                  [
                    "Approval",
                    `Above ${config.automation.approvalAboveMW} MW · expires after ${config.automation.approvalExpiryMin} min`,
                  ],
                ]}
              />
            </Section>

            <section aria-labelledby="scenario-heading">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2
                    id="scenario-heading"
                    className="text-[16px] font-semibold"
                  >
                    Choose a situation to see how BOB will respond
                  </h2>
                  <p className="mt-1 text-[12px] text-[#525252]">
                    Testing uses simulated data and will not control live
                    equipment.
                  </p>
                </div>
                <button
                  onClick={() =>
                    void run(
                      REQUIRED_SIMULATIONS.map((scenario) => scenario.id),
                    )
                  }
                  disabled={running}
                  className="bg-[#0f62fe] px-4 text-[13px] font-semibold text-white hover:bg-[#0353e9] disabled:opacity-50"
                >
                  {running ? "Running simulations…" : "Run all simulations"}
                </button>
              </div>
              <div className="divide-y divide-[#e0e0e0] border border-[#e0e0e0]">
                {REQUIRED_SIMULATIONS.map((scenario) => {
                  const status =
                    session.results[scenario.id]?.status ?? "pending"
                  return (
                    <button
                      key={scenario.id}
                      aria-pressed={selected === scenario.id}
                      onClick={() => select(scenario.id)}
                      className={`flex w-full items-center justify-between gap-3 border-l-2 px-4 py-3 text-left transition-colors ${
                        selected === scenario.id
                          ? "border-l-[#0f62fe] bg-[#edf5ff]"
                          : "border-l-transparent bg-white hover:bg-[#f4f4f4]"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className="text-[13px] font-semibold">
                            {scenarioNames[scenario.id]}
                          </span>
                          <Badge status={status}>
                            {status === "pending"
                              ? "Not tested"
                              : status === "running"
                                ? "Testing"
                                : status === "passed"
                                  ? "Passed"
                                  : "Failed"}
                          </Badge>
                        </div>
                        <p className="text-[12px] leading-relaxed text-[#525252]">
                          {scenario.desc}
                        </p>
                        <p className="mt-1 text-[11px] text-[#6f6f6f]">
                          {scenario.label}
                        </p>
                      </div>
                      <span
                        aria-hidden="true"
                        className="shrink-0 text-lg text-[#0f62fe]"
                      >
                        ›
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>

            <Section
              title={`Test scenario: ${scenarioNames[selected]}`}
              badge="AI — Simulation"
            >
              <p className="mb-4 text-[11px] text-[#6f6f6f]">
                Snapshot:{" "}
                {selected === "above_limit"
                  ? SNAPSHOT_14_50.timestamp
                  : SNAPSHOT_14_32.timestamp}{" "}
                · Preview simulation
              </p>
              <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                {[
                  ["Solar generation", `${inputs.solar} MW`, "Forecast"],
                  ["Site demand", `${inputs.demand} MW`, "Forecast"],
                  ["Demand gap", `${deficit} MW`, "Before battery support"],
                  [
                    "Battery 1",
                    `${inputs.soc}% SOC`,
                    selected === "unavailable"
                      ? "Unavailable"
                      : `Available · reserve ${config.limits.reserveSOC}%`,
                  ],
                ].map(([label, value, detail]) => (
                  <div key={label} className="min-w-0">
                    <p className="mb-1 text-[10px] uppercase tracking-[0.04em] text-[#6f6f6f]">
                      {label}
                    </p>
                    <p
                      className={`text-[20px] font-semibold ${
                        label === "Demand gap"
                          ? "text-[#da1e28]"
                          : "text-[#161616]"
                      }`}
                    >
                      {value}
                    </p>
                    <p className="mt-1 text-[11px] text-[#525252]">{detail}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  onClick={() => void run([selected])}
                  disabled={running}
                  className="bg-[#0f62fe] px-4 text-[13px] font-semibold text-white hover:bg-[#0353e9] disabled:opacity-50"
                >
                  {result?.status === "running"
                    ? "Testing scenario…"
                    : "Review activation safety"}
                </button>
                {normal && (
                  <button
                    onClick={() => {
                      setDraftInputs(session.inputs)
                      setAdjusting((value) => !value)
                    }}
                    disabled={running}
                    className="border border-[#e0e0e0] px-4 text-[13px] hover:bg-[#f4f4f4] disabled:opacity-50"
                  >
                    Adjust scenario
                  </button>
                )}
              </div>
              {adjusting && normal && (
                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    const results = { ...session.results }
                    delete results.normal
                    update({ ...session, inputs: { ...draftInputs }, results })
                    setAdjusting(false)
                  }}
                  className="mt-4 border border-[#e0e0e0] bg-[#f4f4f4] p-4"
                >
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {([
                      ["solar", "Solar generation (MW)", 0, 45],
                      ["demand", "Site demand (MW)", 0, 100],
                      ["soc", "Battery charge (%)", 0, 100],
                      ["temperature", "Battery temperature (°C)", -20, 80],
                    ] as const).map(([key, label, min, max]) => (
                      <label
                        key={key}
                        className="flex flex-col gap-2 text-[12px] text-[#525252]"
                      >
                        {label}
                        <input
                          required
                          type="number"
                          min={min}
                          max={max}
                          step="0.1"
                          value={draftInputs[key]}
                          onChange={(event) =>
                            setDraftInputs((previous) => ({
                              ...previous,
                              [key]: Number(event.target.value),
                            }))
                          }
                          className="min-h-11 min-w-0 border-b border-[#8d8d8d] bg-white px-3 text-[14px] text-[#161616] focus:outline-2 focus:outline-[#0f62fe]"
                        />
                      </label>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="submit"
                      className="bg-[#0f62fe] px-4 text-[12px] text-white"
                    >
                      Apply scenario
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const results = { ...session.results }
                        delete results.normal
                        update({
                          ...session,
                          inputs: { ...initialInputs },
                          results,
                        })
                        setDraftInputs(initialInputs)
                        setAdjusting(false)
                      }}
                      className="border border-[#e0e0e0] bg-white px-4 text-[12px]"
                    >
                      Restore site snapshot
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdjusting(false)}
                      className="px-4 text-[12px] text-[#525252]"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </Section>

            <div
              aria-live="polite"
              className={`border p-4 ${
                result?.status === "passed"
                  ? "border-[#a7f0ba] bg-[#defbe6]"
                  : result?.status === "failed"
                    ? "border-[#ffb3b8] bg-[#fff1f1]"
                    : "border-[#e0e0e0] bg-white"
              }`}
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-[14px] font-semibold">
                  {result?.status === "passed"
                    ? normal
                      ? "BOB can safely execute this action within configured limits"
                      : "BOB responds safely to this scenario"
                    : result?.status === "failed"
                      ? "Activation safety review failed"
                      : result?.status === "running"
                        ? "Simulation in progress"
                        : "Ready to review activation safety"}
                </h2>
                <Badge status="info">AI — Simulation</Badge>
              </div>
              <p className="text-[13px] leading-relaxed text-[#525252]">
                {result?.detail ??
                  "Run this scenario to inspect the response, safety checks, and expected result. All 7 required scenarios must pass before activation."}
              </p>
              {result?.durationMs && (
                <p className="mt-3 text-[11px] text-[#525252]">
                  Simulation completed · {result.checks.length} checks ·{" "}
                  {(result.durationMs / 1000).toFixed(1)} seconds{" "}
                  <button
                    onClick={() => {
                      if (checksRef.current) {
                        checksRef.current.open = true
                        checksRef.current.scrollIntoView({
                          behavior: "smooth",
                          block: "nearest",
                        })
                      }
                    }}
                    className="ml-3 text-[#0f62fe] underline"
                  >
                    View test checks
                  </button>
                </p>
              )}
            </div>

            <Section title="When will BOB act?">
              <div className="flex flex-col gap-2 text-[13px] text-[#525252]">
                {[
                  `Demand exceeds solar by more than ${config.trigger.deficitMW} MW`,
                  `Gap continues for ${config.trigger.delayMin} minutes`,
                  `Battery charge exceeds 60% and configured reserve ${config.limits.reserveSOC}%`,
                  "Battery 1 is available and temperature is at or below 45°C",
                  "Live battery data is fresh; no health warning or active maintenance",
                  `Action stays within ${config.limits.maxDuration} min / ${config.limits.maxEnergyMWh} MWh limits`,
                ].map((text) => (
                  <p key={text} className="flex items-start gap-2">
                    <span
                      aria-hidden="true"
                      className="mt-1.5 size-2 shrink-0 rounded-full bg-[#24a148]"
                    />
                    {text}
                  </p>
                ))}
              </div>
              <p className="mt-4 bg-[#f4f4f4] p-3 text-[12px] text-[#525252]">
                This scenario has a {deficit} MW pre-battery gap.{" "}
                {normal
                  ? `Battery 1 has ${usableMWh.toFixed(1)} MWh usable above the configured reserve.`
                  : "Safety checks determine whether execution is allowed, stopped, or held."}
              </p>
            </Section>

            <Section title="What will BOB do?" badge="AI — Planned action">
              <ol className="flex flex-col gap-3 text-[13px] text-[#525252]">
                {(normal
                  ? [
                      `Start discharging Battery 1 after the ${config.trigger.delayMin}-minute trigger window`,
                      `Cover up to ${config.limits.autoMaxMW} MW automatically, without crossing the ${config.limits.reserveSOC}% reserve`,
                      "Monitor battery charge, temperature, availability, health, and telemetry freshness",
                      `Stop when demand normalizes, reserve is reached, or the ${config.limits.maxDuration} min / ${config.limits.maxEnergyMWh} MWh cap is reached`,
                      `Notify configured users through ${config.notifications.join(" and ") || "the configured channels"}`,
                    ]
                  : [
                      result?.detail ??
                        "Evaluate the selected safety or approval scenario",
                      "Do not execute unsafe commands or use stale telemetry",
                      "Record the blocked, held, stopped, or awaiting-approval outcome",
                      "Notify operators and preserve protected site boundaries",
                    ]
                ).map((text, index) => (
                  <li key={text} className="flex items-start gap-3">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#0f62fe] text-[11px] text-white">
                      {index + 1}
                    </span>
                    <span>{text}</span>
                  </li>
                ))}
              </ol>
            </Section>

            <Section title="How will the action progress?">
              <ol className="ml-2 border-l border-[#c6c6c6] pl-5">
                {[
                  [
                    "NOW",
                    `Solar ${inputs.solar} MW · Demand ${inputs.demand} MW · Gap ${deficit} MW · Battery ${inputs.soc}% · Temperature ${inputs.temperature}°C`,
                  ],
                  [
                    `AFTER ${config.trigger.delayMin} MIN`,
                    "Trigger confirmed · Battery verified · Fresh telemetry and protected limits checked",
                  ],
                  [
                    "ACTION STARTS",
                    normal && result?.status === "passed"
                      ? `Battery 1 supplies ${discharge} MW · Demand fully supplied · Grid import 0 MW`
                      : "Execution depends on the selected scenario and safety review",
                  ],
                  [
                    "DURING EXECUTION",
                    "Battery charge, temperature, health, and telemetry are continuously monitored",
                  ],
                  [
                    "ACTION ENDS WHEN",
                    `Demand normalizes · Battery reaches ${config.limits.reserveSOC}% · Temperature exceeds 45°C · Data becomes stale · ${config.limits.maxDuration} min / ${config.limits.maxEnergyMWh} MWh cap is reached`,
                  ],
                ].map(([title, detail], index) => (
                  <li key={title} className="relative pb-5 last:pb-0">
                    <span
                      className={`absolute -left-[25px] top-1 size-2 rounded-full ${
                        index === 2
                          ? "bg-[#24a148]"
                          : index === 0
                            ? "bg-[#0f62fe]"
                            : "bg-[#8d8d8d]"
                      }`}
                    />
                    <p className="mb-1 text-[10px] font-semibold tracking-[0.04em] text-[#525252]">
                      {title}
                    </p>
                    <p className="text-[12px] leading-relaxed text-[#525252]">
                      {detail}
                    </p>
                  </li>
                ))}
              </ol>
            </Section>

            <Section title="How will energy flow?">
              <div className="flex flex-col gap-4">
                {[
                  ["BEFORE", Math.min(inputs.solar, inputs.demand), 0, deficit],
                  [
                    "DURING",
                    Math.min(inputs.solar, inputs.demand),
                    discharge,
                    Math.max(0, deficit - discharge),
                  ],
                ].map(([label, solar, battery, gap]) => (
                  <div key={label}>
                    <p className="mb-2 text-[10px] font-semibold tracking-[0.04em] text-[#6f6f6f]">
                      {label}
                    </p>
                    <div
                      className={`grid grid-cols-1 gap-3 border p-4 text-center sm:grid-cols-3 ${
                        label === "DURING" && discharge
                          ? "border-[#a7f0ba] bg-[#defbe6]"
                          : "border-[#e0e0e0] bg-[#f4f4f4]"
                      }`}
                    >
                      <div>
                        <p className="text-[12px] text-[#525252]">
                          Solar{" "}
                          {Number(battery) > 0 ? `+ Battery ${battery} MW` : ""}
                        </p>
                        <p className="text-[17px] font-semibold">
                          {Number(solar) + Number(battery)} MW
                        </p>
                      </div>
                      <div>
                        <p className="text-[12px] text-[#525252]">Demand</p>
                        <p className="text-[17px] font-semibold">
                          {inputs.demand} MW
                        </p>
                      </div>
                      <div>
                        <p className="text-[12px] text-[#525252]">
                          Remaining gap
                        </p>
                        <p
                          className={`text-[17px] font-semibold ${
                            Number(gap) > 0
                              ? "text-[#da1e28]"
                              : "text-[#198038]"
                          }`}
                        >
                          {gap} MW
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                {inputs.solar > inputs.demand && <p className="text-xs text-[#525252]">Available solar exceeds demand by {inputs.solar - inputs.demand} MW. The displayed simulation flow curtails this excess; charging and export remain 0 MW. No curtailment command is sent.</p>}
              </div>
            </Section>

            <Section title="What protects the battery and site?">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {[
                  [
                    "WILL NOT EXCEED",
                    [
                      `Max automatic discharge ${config.limits.autoMaxMW} MW`,
                      `Equipment maximum ${BATTERY_POLICY.equipmentMaxMW} MW`,
                      `Max duration ${config.limits.maxDuration} min`,
                      `Max energy ${config.limits.maxEnergyMWh} MWh`,
                      `Configured reserve ${config.limits.reserveSOC}%`,
                      "Immutable emergency floor 30% SOC",
                    ],
                  ],
                  [
                    "WILL STOP IF",
                    [
                      `Battery reaches ${config.limits.reserveSOC}% reserve`,
                      "Temperature exceeds 45°C",
                      "Battery-health warning is raised",
                      "Live telemetry is unsafe, unavailable, or stale",
                      "Demand normalizes",
                      "Battery rejects the command",
                      "Duration or energy cap is reached",
                    ],
                  ],
                ].map(([title, rules]) => (
                  <div key={String(title)}>
                    <h3 className="mb-3 text-[10px] font-semibold tracking-[0.04em] text-[#6f6f6f]">
                      {title}
                    </h3>
                    <div className="flex flex-col gap-2">
                      {(rules as string[]).map((rule) => (
                        <p
                          key={rule}
                          className="bg-[#f4f4f4] px-3 py-2 text-[12px] text-[#525252]"
                        >
                          {rule}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-4 bg-[#f4f4f4] p-3 text-[12px] text-[#525252]">
                BOB cannot continue if any safety condition is no longer
                satisfied.
              </p>
            </Section>

            <Section title="Is approval required?">
              <p className="mb-3 text-[13px] font-semibold text-[#198038]">
                {selected === "above_limit"
                  ? "Administrator approval is required for the 8 MW request"
                  : normal
                    ? "No approval required within the configured automatic limit"
                    : "Safety blocking does not require approval; unsafe execution remains blocked"}
              </p>
              <DataRows
                rows={[
                  ["Automatic limit", `${config.limits.autoMaxMW} MW`],
                  [
                    "Approval boundary",
                    `Above ${config.automation.approvalAboveMW} MW`,
                  ],
                  [
                    "Approval expiry",
                    `${config.automation.approvalExpiryMin} min`,
                  ],
                  [
                    "Battery reserve",
                    `Protected at ${config.limits.reserveSOC}%`,
                  ],
                  [
                    "Grid import",
                    normal && result?.status === "passed"
                      ? "Not required for this discharge"
                      : selected === "above_limit"
                        ? "At 14:50, a separate 8 MW / 15 min grid-import approval is required"
                        : "Not automatically executed by this test",
                  ],
                ]}
              />
            </Section>

            {selected === "above_limit" && (
              <Section title="14:50 grid-import approval boundary">
                <DataRows
                  rows={[
                    [
                      "Site balance",
                      "Solar 38 MW + automatic battery 6 MW = 44 MW against 52 MW demand",
                    ],
                    ["Remaining deficit", "8 MW"],
                    [
                      "Proposed grid import",
                      "Administrator-approved 8 MW for 15 min · 2 MWh",
                    ],
                    ["Approval expiry", "10 min"],
                    [
                      "If modified to 6 MW",
                      "38 + 6 + 6 = 50 MW · 2 MW deficit remains",
                    ],
                    [
                      "Safety boundary",
                      "No execution without approval and verified fresh telemetry",
                    ],
                  ]}
                />
              </Section>
            )}

            <Section
              title="What is the expected result?"
              badge="AI — Predictions"
            >
              <DataRows
                rows={[
                  [
                    "Demand",
                    normal && result?.status === "passed"
                      ? "Fully supplied · no grid import"
                      : "No unsafe automatic execution",
                  ],
                  [
                    "Battery after",
                    discharge
                      ? `${afterSOC.toFixed(0)}% SOC · reserve protected`
                      : "No simulated discharge",
                  ],
                  [
                    "Grid import",
                    discharge ? "0 MW" : "No automatic import command",
                  ],
                  [
                    "Reserve",
                    `Protected above configured ${config.limits.reserveSOC}%`,
                  ],
                  [
                    "Duration",
                    discharge
                      ? `${durationMin.toFixed(0)} min · capped by duration and energy`
                      : "Execution blocked, held, or awaiting review",
                  ],
                  [
                    "Energy used",
                    discharge
                      ? `${((discharge * durationMin) / 60).toFixed(1)} MWh`
                      : "0 MWh",
                  ],
                ]}
              />
              <p className="mt-4 text-[11px] leading-relaxed text-[#6f6f6f]">
                Expected values use simulated data. Actual results may change.
                Preview checks do not replace authoritative telemetry, backend
                validation, or administrator approval.
              </p>
            </Section>

            <details
              ref={checksRef}
              className="border border-[#e0e0e0] bg-white p-5"
            >
              <summary className="cursor-pointer text-[13px] font-semibold">
                View technical validation
              </summary>
              <div className="mt-4 flex flex-col gap-2 text-[12px] text-[#525252]">
                {result?.checks.length ? (
                  result.checks.map((check) => (
                    <p key={check} className="border-b border-[#e0e0e0] py-2">
                      {check}
                    </p>
                  ))
                ) : (
                  <p>Run the selected simulation to view test checks.</p>
                )}
                <p className="mt-2">
                  Simulation mode: frontend policy preview. No live commands are
                  sent.
                </p>
              </div>
            </details>

            <Section title="Recommended before activation">
              <p className="mb-4 text-[12px] text-[#525252]">
                All seven required scenarios must pass: normal execution, safety
                blocking, reserve protection, recovery, and approval handling.
              </p>
              <div className="flex flex-col gap-2">
                {REQUIRED_SIMULATIONS.map((scenario) => (
                  <div
                    key={scenario.id}
                    className={`flex flex-wrap items-center justify-between gap-3 p-3 text-[12px] ${
                      session.results[scenario.id]?.status === "passed"
                        ? "bg-[#defbe6]"
                        : "bg-[#f4f4f4]"
                    }`}
                  >
                    <span>{scenarioNames[scenario.id]}</span>
                    <Badge
                      status={session.results[scenario.id]?.status ?? "pending"}
                    >
                      {session.results[scenario.id]?.status === "passed"
                        ? "Passed"
                        : session.results[scenario.id]?.status === "failed"
                          ? "Failed"
                          : session.results[scenario.id]?.status === "running"
                            ? "Testing"
                            : "Not tested"}
                    </Badge>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-[12px] text-[#525252]">
                {failedCount
                  ? `${failedCount} failed. Resolve the safety review before activation.`
                  : `${passedCount} passed · ${7 - passedCount} remaining`}
              </p>
            </Section>
          </div>
        </main>

        <aside className="min-w-0 border-t border-[#e0e0e0] bg-white lg:border-l lg:border-t-0">
          <div className="lg:sticky lg:top-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e0e0e0] px-5 py-4">
              <h2 className="text-[15px] font-semibold">Configured actions</h2>
              <span className="text-[12px] text-[#525252]">1 action</span>
              <button
                onClick={onConfigure}
                disabled={running}
                className="border border-[#e0e0e0] px-3 text-[12px] disabled:opacity-50"
              >
                Add action
              </button>
            </div>
            <div className="flex flex-col gap-4 p-5">
              <div className="border border-[#0f62fe] p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-[14px] font-semibold">
                    Support demand using Battery 1
                  </h3>
                  <Badge status={allPassed ? "passed" : "info"}>
                    {allPassed
                      ? "Tested"
                      : running
                        ? "Testing"
                        : "Ready to test"}
                  </Badge>
                </div>
                <p className="mb-4 text-[12px] text-[#525252]">
                  7 of 7 settings complete
                </p>
                <DataRows
                  rows={[
                    ["Test coverage", `${passedCount} of 7 required`],
                    ["Current scenario", scenarioNames[selected]],
                    [
                      "Safety review",
                      allPassed
                        ? "Passed · 7 required scenarios"
                        : "Activation blocked until all pass",
                    ],
                  ]}
                />
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      checksRef.current?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      })
                      if (checksRef.current) checksRef.current.open = true
                    }}
                    className="border border-[#e0e0e0] px-3 text-[12px]"
                  >
                    View details
                  </button>
                  <button
                    onClick={onBack}
                    disabled={running}
                    className="border border-[#e0e0e0] px-3 text-[12px] disabled:opacity-50"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => void run([selected])}
                    disabled={running}
                    className="bg-[#0f62fe] px-3 text-[12px] text-white disabled:opacity-50"
                  >
                    Test
                  </button>
                </div>
              </div>
              <div className="border border-[#e0e0e0] p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-[14px] font-semibold">
                    Charge battery using surplus solar
                  </h3>
                  <Badge>Draft</Badge>
                </div>
                <p className="mb-3 text-[12px] text-[#525252]">
                  Not configured · no surplus in the current snapshot
                </p>
                <button
                  onClick={onConfigure}
                  disabled={running}
                  className="border border-[#e0e0e0] px-3 text-[12px] disabled:opacity-50"
                >
                  Continue setup
                </button>
              </div>
              <div className="border border-[#e0e0e0] p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-[14px] font-semibold">
                    Sell surplus electricity
                  </h3>
                  <Badge>Connection required</Badge>
                </div>
                <p className="mb-3 text-[12px] text-[#525252]">
                  Electricity market not connected
                </p>
                <button
                  onClick={onConnectData}
                  disabled={running}
                  className="border border-[#e0e0e0] px-3 text-[12px] disabled:opacity-50"
                >
                  Connect market
                </button>
              </div>
              <div className="border-l-2 border-[#0f62fe] bg-[#edf5ff] p-4">
                <h3 className="mb-2 text-[13px] font-semibold text-[#0043ce]">
                  Simulation only
                </h3>
                <p className="text-[12px] leading-relaxed text-[#525252]">
                  Your configuration is not active. Testing does not send
                  battery or grid commands. All 7 required scenarios must pass
                  before continuing.
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>
      <footer className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t border-[#e0e0e0] bg-white px-4 py-4 md:px-6">
        <button
          onClick={onBack}
          disabled={running}
          className="border border-[#e0e0e0] px-4 text-[13px] disabled:opacity-50"
        >
          Back to review
        </button>
        <div className="flex flex-wrap items-center gap-3">
          <p role="status" className="text-[12px] text-[#525252]">
            {running
              ? "Testing — activation is locked"
              : `${passedCount} of 7 required scenarios passed`}
          </p>
          <button
            onClick={canProceed}
            disabled={!allPassed}
            className="bg-[#0f62fe] px-5 text-[13px] font-semibold text-white hover:bg-[#0353e9] disabled:cursor-not-allowed disabled:bg-[#c6c6c6] disabled:text-[#525252]"
          >
            {operations.state.activated && JSON.stringify(operations.state.activeConfig) === configKey && ['Active','Executing','Completed'].includes(operations.state.stage) ? 'View active monitoring →' : 'Continue to activation →'}
          </button>
        </div>
      </footer>
    </div>
  )
}
