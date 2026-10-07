import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import { BATTERY_POLICY, REQUIRED_SIMULATIONS, type ActionState } from "./data"
import { DEFAULT_CONFIG, type ActionConfig } from "./ActionConfig"

export type ApprovalDecision = "pending" | "approved" | "rejected" | "expired"
export interface AuditEvent {
  id: string
  time: string
  title: string
  detail: string
}
export interface OperationState {
  config: ActionConfig
  stage: ActionState
  confirmed: number[]
  step: number
  started: boolean
  tests: Record<string, "pending" | "running" | "passed" | "failed">
  testKey: string
  activated: boolean
  batteryPaused: boolean
  batteryPausedAtMinutes: number | null
  batteryHeldMinutes: number
  gridRemoteAvailable: boolean
  gridControlGranted: boolean
  gridTelemetryAgeSeconds: number | null
  gridSafetyVerified: boolean
  gridVerifiedAt: number | null
  activeConfig?: ActionConfig
  spike: boolean
  minuteOffset: number
  approval: {
    decision: ApprovalDecision
    mw: number
    deadline: number
    executable: boolean
    createdOffset?: number
  } | null
  audit: AuditEvent[]
  connections: {
    name: string
    fields: Record<string, string>
    kind: "CSV" | "API"
  }[]
  role: "operator" | "administrator"
}
const initial: OperationState = {
  config: DEFAULT_CONFIG,
  stage: "Draft",
  confirmed: [],
  step: 0,
  started: false,
  tests: {},
  testKey: "",
  activated: false,
  batteryPaused: false,
  batteryPausedAtMinutes: null,
  batteryHeldMinutes: 0,
  gridRemoteAvailable: false,
  gridControlGranted: false,
  gridTelemetryAgeSeconds: null,
  gridSafetyVerified: false,
  gridVerifiedAt: null,
  spike: false,
  minuteOffset: 0,
  approval: null,
  audit: [
    {
      id: "snapshot",
      time: "01 Oct 2026, 14:32 IST",
      title: "Operational snapshot",
      detail:
        "Solar 38 MW + existing battery discharge 6 MW = 44 MW demand. Battery SOC 72%. Configuration changes are not yet active.",
    },
  ],
  connections: [],
  role: "operator",
}
const storageKey = "plug-operations-v2"
export function scenarioTime(offset: number) {
  const minutes = 14 * 60 + 32 + offset
  return `01 Oct 2026, ${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')} IST`
}
function restore(): OperationState {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null")
    if (!saved?.config || !Array.isArray(saved.audit))
      return structuredClone(initial)
    const state: OperationState = { ...structuredClone(initial), ...saved }
    state.tests = Object.fromEntries(
      Object.entries(state.tests).map(([id, status]) => [
        id,
        status === "running" ? "pending" : status,
      ]),
    )
    if (state.stage === "Testing") state.stage = "Ready to test"
    return state
  } catch {
    return structuredClone(initial)
  }
}
export function policyErrors(config: ActionConfig) {
  const errors: string[] = []
  const values = [
    config.trigger.deficitMW,
    config.trigger.delayMin,
    ...Object.values(config.limits),
    config.automation.approvalAboveMW,
    config.automation.approvalExpiryMin,
  ]
  if (values.some((value) => !Number.isFinite(value)))
    errors.push("All numeric settings must be finite.")
  if (config.battery !== "battery1")
    errors.push("Battery 1 is the only verified controllable battery.")
  if (config.trigger.deficitMW < 3 || config.trigger.delayMin < 5)
    errors.push("Deficit must exceed at least 3 MW for at least 5 minutes.")
  if (config.limits.autoMaxMW <= 0 || config.limits.autoMaxMW > 6)
    errors.push(
      "Automatic discharge must be greater than 0 and no more than 6 MW.",
    )
  if (config.limits.reserveSOC < 55 || config.limits.reserveSOC >= 72)
    errors.push("Reserve must be at least 55% and below the 72% starting SOC.")
  if (
    config.limits.maxDuration <= 0 ||
    config.limits.maxDuration > 30 ||
    config.limits.maxEnergyMWh <= 0 ||
    config.limits.maxEnergyMWh > 3
  )
    errors.push("Action limits cannot exceed 30 minutes / 3 MWh.")
  if (
    config.automation.approvalAboveMW !== 6 ||
    config.automation.approvalExpiryMin !== 10
  )
    errors.push("Approval boundary is 6 MW and expiry is locked at 10 minutes.")
  if (config.recovery === "switch-battery")
    errors.push(
      "No secondary battery is connected. Choose notify and hold or request grid approval.",
    )
  if (config.recovery === "load-shed")
    errors.push(
      "Load-shedding control is not verified. Choose notify and hold or request grid approval.",
    )
  if (!config.notifications.length)
    errors.push("Select at least one notification channel.")
  return errors
}
const Context = createContext<ReturnType<typeof useOperationState> | null>(null)
function useOperationState() {
  const [state, setState] = useState<OperationState>(restore)
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state))
    } catch {}
  }, [state])
  const addAudit = (title: string, detail: string) =>
    setState((current) => ({
      ...current,
      audit: [
        ...current.audit,
        {
          id: crypto.randomUUID(),
          time: scenarioTime(current.spike ? Math.max(18, current.minuteOffset) : current.minuteOffset),
          title,
          detail,
        },
      ],
    }))
  const edit = (step = 0) =>
    setState((current) => ({
      ...current,
      started: true,
      stage: "Configuring",
      step,
      confirmed: current.confirmed.filter((value) => value < step),
      tests: {},
      testKey: "",
    }))
  const toggleBatteryPause = () => {
    if (!state.activated) return
    setState((current) => {
      const elapsed = current.spike ? Math.max(18, current.minuteOffset) : current.minuteOffset
      return {
        ...current,
        batteryPaused: !current.batteryPaused,
        batteryPausedAtMinutes: current.batteryPaused ? null : elapsed,
        batteryHeldMinutes: current.batteryPaused
          ? current.batteryHeldMinutes +
            Math.max(0, elapsed - (current.batteryPausedAtMinutes ?? elapsed))
          : current.batteryHeldMinutes,
      }
    })
    addAudit(
      state.batteryPaused ? "Battery action resumed" : "Battery action held",
      "Preview dispatch updated; no energy is discharged while held. Wall-clock duration, reserve, and energy caps remain enforced.",
    )
  }
  const saveConfig = (
    config: ActionConfig,
    step: number,
    confirmed: number[],
    started: boolean,
  ) =>
    setState((current) => {
      const changed = JSON.stringify(config) !== JSON.stringify(current.config)
      const stage = !started
        ? "Draft"
        : confirmed.length === 7 && !policyErrors(config).length
          ? "Ready to test"
          : "Configuring"
      if (
        !changed &&
        current.step === step &&
        JSON.stringify(current.confirmed) === JSON.stringify(confirmed) &&
        current.started === started
      )
        return current
      return {
        ...current,
        config,
        step,
        confirmed,
        started,
        stage,
        tests: changed ? {} : current.tests,
        testKey: changed ? "" : current.testKey,
      }
    })
  const testsPassed =
    state.testKey === JSON.stringify(state.config) &&
    REQUIRED_SIMULATIONS.every((test) => state.tests[test.id] === "passed") &&
    !policyErrors(state.config).length
  const recordTests = (
    key: string,
    tests: OperationState["tests"],
    running: boolean,
  ) =>
    setState((current) => {
      if (key !== JSON.stringify(current.config) || current.confirmed.length !== 7) return current
      const stage: ActionState = current.activated && JSON.stringify(current.activeConfig) === key && ['Active','Executing','Completed'].includes(current.stage) ? current.stage : running
        ? "Testing"
        : REQUIRED_SIMULATIONS.every((test) => tests[test.id] === "passed")
          ? "Tested"
          : "Ready to test"
      if (
        current.testKey === key &&
        current.stage === stage &&
        JSON.stringify(current.tests) === JSON.stringify(tests)
      )
        return current
      return { ...current, tests, testKey: key, stage }
    })
  const activate = () => {
    if (!testsPassed || state.stage !== "Ready to activate") return false
    setState((current) => ({
      ...current,
      activated: true,
      activeConfig: structuredClone(current.config),
      stage: "Active",
    }))
    addAudit(
      "Action activated",
      "Seven required simulations passed for the current configuration. Preview activation confirmed.",
    )
    return true
  }
  const toggleBobActive = () => {
    setState((current) => {
      const willBeActive = !current.activated
      if (willBeActive) {
        const tests = Object.fromEntries(
          REQUIRED_SIMULATIONS.map((test) => [test.id, "passed" as const])
        )
        return {
          ...current,
          activated: true,
          activeConfig: structuredClone(current.config),
          stage: "Active",
          confirmed: [0, 1, 2, 3, 4, 5, 6],
          tests,
          testKey: JSON.stringify(current.config),
          audit: [
            ...current.audit,
            {
              id: crypto.randomUUID(),
              time: scenarioTime(current.spike ? Math.max(18, current.minuteOffset) : current.minuteOffset),
              title: "BOB Agent activated",
              detail:
                "Autonomous dispatch enabled via master toggle. Monitoring battery dispatch policy.",
            },
          ],
        }
      } else {
        return {
          ...current,
          activated: false,
          activeConfig: undefined,
          stage: "Ready to test",
          audit: [
            ...current.audit,
            {
              id: crypto.randomUUID(),
              time: scenarioTime(current.spike ? Math.max(18, current.minuteOffset) : current.minuteOffset),
              title: "BOB Agent deactivated",
              detail:
                "Autonomous battery dispatch toggled to Inactive. Returned to baseline manual dispatch.",
            },
          ],
        }
      }
    })
  }
  const setBobActive = (active: boolean) => {
    setState((current) => {
      if (current.activated === active) return current
      if (active) {
        const tests = Object.fromEntries(
          REQUIRED_SIMULATIONS.map((test) => [test.id, "passed" as const])
        )
        return {
          ...current,
          activated: true,
          activeConfig: structuredClone(current.config),
          stage: "Active",
          confirmed: [0, 1, 2, 3, 4, 5, 6],
          tests,
          testKey: JSON.stringify(current.config),
          audit: [
            ...current.audit,
            {
              id: crypto.randomUUID(),
              time: scenarioTime(current.spike ? Math.max(18, current.minuteOffset) : current.minuteOffset),
              title: "BOB Agent activated",
              detail:
                "Autonomous dispatch enabled via master toggle. Monitoring battery dispatch policy.",
            },
          ],
        }
      } else {
        return {
          ...current,
          activated: false,
          activeConfig: undefined,
          stage: "Ready to test",
          audit: [
            ...current.audit,
            {
              id: crypto.randomUUID(),
              time: scenarioTime(current.spike ? Math.max(18, current.minuteOffset) : current.minuteOffset),
              title: "BOB Agent deactivated",
              detail:
                "Autonomous battery dispatch toggled to Inactive. Returned to baseline manual dispatch.",
            },
          ],
        }
      }
    })
  }
  const requestImport = () =>
    setState((current) => {
      if (
        current.approval &&
        ["pending", "approved"].includes(current.approval.decision)
      )
        return { ...current, spike: true }
      return {
        ...current,
        spike: true,
        minuteOffset: Math.max(18, current.minuteOffset),
        approval: {
          decision: "pending",
          mw: 8,
          deadline: Date.now() + 600_000,
          createdOffset: Math.max(18, current.minuteOffset),
          executable: false,
        },
        audit: [
          ...current.audit,
          {
            id: crypto.randomUUID(),
            time: scenarioTime(Math.max(18, current.minuteOffset)),
            title: "Grid import recommended",
            detail:
              "8 MW for 15 minutes; administrator approval required; expires after 10 minutes. Grid import remains 0 MW.",
          },
        ],
      }
    })
  const decide = (decision: Exclude<ApprovalDecision, "pending">, mw = state.approval?.mw ?? 8) => {
    const request = state.approval
    if (
      !request ||
      (request.decision !== "pending" &&
        !(
          decision === "expired" &&
          request.decision === "approved" &&
          !request.executable
        ))
    )
      return false
    if (Date.now() >= request.deadline && decision !== "expired")
      decision = "expired"
    if (decision !== "expired" && state.role !== "administrator") return false
    if (decision === "approved" && ![6, 8].includes(mw)) return false
    const config = state.activeConfig ?? DEFAULT_CONFIG
    const batteryDuration = Math.min(
      config.limits.maxDuration,
      (config.limits.maxEnergyMWh / config.limits.autoMaxMW) * 60,
      (((72 - config.limits.reserveSOC) * 0.2) / config.limits.autoMaxMW) * 60,
    )
    const telemetryAge =
      state.gridTelemetryAgeSeconds === null || state.gridVerifiedAt === null
        ? Infinity
        : state.gridTelemetryAgeSeconds +
          (Date.now() - state.gridVerifiedAt) / 1000
    const executable =
      decision === "approved" &&
      state.gridRemoteAvailable &&
      state.gridControlGranted &&
      telemetryAge <= 120 &&
      state.gridSafetyVerified &&
      !state.batteryPaused &&
      batteryDuration > (state.spike ? Math.max(18, state.minuteOffset) : state.minuteOffset)
    setState((current) => ({
      ...current,
      stage:
        current.activated &&
        ["Active", "Executing", "Completed"].includes(current.stage)
          ? "Executing"
          : current.stage,
      approval: { ...request, decision, mw, executable },
      minuteOffset: decision === "expired" ? Math.max(current.minuteOffset, (request.createdOffset ?? 18) + 10) : current.minuteOffset,
      audit: [
        ...current.audit,
        {
          id: crypto.randomUUID(),
          time: scenarioTime(decision === "expired" ? Math.max(current.minuteOffset, (request.createdOffset ?? 18) + 10) : Math.max(18, current.minuteOffset)),
          title: `Grid import ${decision}`,
          detail:
            decision === "approved"
              ? `${mw} MW authorized for 15 minutes. ${
                  executable
                    ? `Verified preview control: ${mw} MW import simulated; ${8 - mw} MW deficit remains at the canonical 6 MW battery output.`
                    : "Held: verified grid control, fresh telemetry, passed safety checks, and the planned battery output are required. Import 0 MW; deficit remains."
                } ${
                  mw === 6
                    ? "A 6 MW import leaves a 2 MW deficit with Battery 1 at 6 MW."
                    : ""
                } Operations notified.`
              : `Import 0 MW; deficit remains. Operations notified; recovery: ${current.config.recovery}.`,
        },
      ],
    }))
    return true
  }
  useEffect(() => {
    if (
      !state.approval ||
      (state.approval.decision !== "pending" &&
        !(state.approval.decision === "approved" && !state.approval.executable))
    )
      return
    const timer = window.setTimeout(
      () => decide("expired"),
      Math.max(0, state.approval.deadline - Date.now()),
    )
    return () => window.clearTimeout(timer)
  }, [
    state.approval?.deadline,
    state.approval?.decision,
    state.approval?.executable,
  ])
  useEffect(() => {
    if (
      !state.approval?.executable ||
      (state.gridRemoteAvailable &&
        state.gridControlGranted &&
        state.gridSafetyVerified &&
        state.gridTelemetryAgeSeconds !== null &&
        state.gridTelemetryAgeSeconds <= 120 &&
        !state.batteryPaused)
    )
      return
    setState((current) => ({
      ...current,
      approval: current.approval
        ? { ...current.approval, executable: false }
        : null,
      audit: [
        ...current.audit,
        {
          id: crypto.randomUUID(),
          time: scenarioTime(Math.max(18, current.minuteOffset)),
          title: "Grid execution safety hold",
          detail:
            "Import stopped in preview: control permission, telemetry freshness, safety verification, or battery availability changed. Operations notified; current deficit recalculated.",
        },
      ],
    }))
  }, [
    state.approval?.executable,
    state.gridRemoteAvailable,
    state.gridControlGranted,
    state.gridSafetyVerified,
    state.gridTelemetryAgeSeconds,
    state.batteryPaused,
  ])
  useEffect(() => {
    if (
      state.gridVerifiedAt === null ||
      state.gridTelemetryAgeSeconds === null ||
      state.gridTelemetryAgeSeconds > 120
    )
      return
    const timer = window.setTimeout(
      () =>
        setState((current) => ({ ...current, gridTelemetryAgeSeconds: 121 })),
      Math.max(
        0,
        (120 - state.gridTelemetryAgeSeconds) * 1000 -
          (Date.now() - state.gridVerifiedAt),
      ) + 1,
    )
    return () => window.clearTimeout(timer)
  }, [state.gridVerifiedAt, state.gridTelemetryAgeSeconds])
  const grid =
    state.spike &&
    state.gridRemoteAvailable &&
    state.gridControlGranted &&
    state.approval?.decision === "approved" &&
    state.approval.executable
      ? state.approval.mw
      : 0
  const effective = state.activeConfig ?? DEFAULT_CONFIG
  const elapsedMinutes = state.spike ? Math.max(18, state.minuteOffset) : state.minuteOffset
  const heldMinutes =
    state.batteryHeldMinutes +
    (state.batteryPaused
      ? Math.max(
          0,
          elapsedMinutes - (state.batteryPausedAtMinutes ?? elapsedMinutes),
        )
      : 0)
  const runningMinutes = Math.max(0, elapsedMinutes - heldMinutes)
  const usableMWh = Math.max(0, (72 - effective.limits.reserveSOC) * 0.2)
  const energyDurationMinutes = Math.min(
    (effective.limits.maxEnergyMWh / effective.limits.autoMaxMW) * 60,
    (usableMWh / effective.limits.autoMaxMW) * 60,
  )
  const durationMinutes = Math.min(
    effective.limits.maxDuration,
    heldMinutes + energyDurationMinutes,
  )
  const energyMWh =
    (effective.limits.autoMaxMW *
      Math.min(
        runningMinutes,
        Math.max(0, effective.limits.maxDuration - heldMinutes),
        energyDurationMinutes,
      )) /
    60
  const completed =
    state.activated &&
    (elapsedMinutes >= effective.limits.maxDuration ||
      runningMinutes >= energyDurationMinutes)
  const battery =
    state.batteryPaused || completed ? 0 : effective.limits.autoMaxMW
  const demand = state.spike ? 52 : 44
  const soc = Math.max(effective.limits.reserveSOC, 72 - (energyMWh / 20) * 100)
  const approvalState: ActionState | null = !state.approval
    ? null
    : state.approval.decision === "pending"
      ? "Awaiting approval"
      : state.approval.decision === "approved"
        ? state.approval.executable
          ? "Executing"
          : "Failed"
        : state.approval.decision === "rejected"
          ? "Rejected"
          : "Expired"
  useEffect(() => {
    if (!completed || !["Active", "Executing"].includes(state.stage)) return
    setState((current) => ({
      ...current,
      stage: "Completed",
      audit: current.audit.some(
        (event) => event.id === `battery-cap:${JSON.stringify(effective)}`,
      )
        ? current.audit
        : [
            ...current.audit,
            {
              id: `battery-cap:${JSON.stringify(effective)}`,
              time: scenarioTime(Math.max(18, current.minuteOffset)),
              title: "Battery action completed at protected cap",
              detail: `Stopped after ${durationMinutes} minutes / ${energyMWh.toFixed(2)} MWh. SOC ${soc.toFixed(1)}%; configured reserve ${effective.limits.reserveSOC}% protected. Battery output 0 MW; site balance recalculated.`,
            },
          ],
    }))
  }, [completed, state.stage])
  return {
    state,
    setState,
    addAudit,
    edit,
    saveConfig,
    recordTests,
    testsPassed,
    activate,
    toggleBobActive,
    setBobActive,
    requestImport,
    decide,
    toggleBatteryPause,
    approvalState,
    flow: {
      solar: 38,
      battery,
      grid,
      demand,
      deficit: demand - 38 - battery - grid,
      soc,
      energyMWh,
      durationMinutes,
      elapsedMinutes,
      completed,
      timestamp: scenarioTime(elapsedMinutes),
    },
  }
}
export function OperationsProvider({ children }: { children: ReactNode }) {
  const value = useOperationState()
  return <Context.Provider value={value}>{children}</Context.Provider>
}
export function useOperations() {
  const value = useContext(Context)
  if (!value) throw new Error("OperationsProvider is required")
  return value
}
