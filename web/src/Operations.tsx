import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import { BATTERY_POLICY, REQUIRED_SIMULATIONS, SNAPSHOT_14_32, type ActionState } from "./data"
import { DEFAULT_CONFIG, type ActionConfig } from "./ActionConfig"

export interface OperationState {
  config: ActionConfig
  stage: ActionState
  confirmed: number[]
  step: number
  started: boolean
  tests: Record<string, "pending" | "running" | "passed" | "failed">
  testKey: string
  activated: boolean
  activeConfig?: ActionConfig
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
}
const storageKey = "plug-operations-v3"
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
    return true
  }
  return {
    state,
    setState,
    edit,
    saveConfig,
    recordTests,
    testsPassed,
    activate,
    // The configuration journey's fixed snapshot, until it moves onto the server's configs.
    flow: {
      solar: SNAPSHOT_14_32.solar,
      battery: SNAPSHOT_14_32.batteryDischarge,
      grid: SNAPSHOT_14_32.gridImport,
      demand: SNAPSHOT_14_32.demand,
      deficit: SNAPSHOT_14_32.demand - SNAPSHOT_14_32.solar - SNAPSHOT_14_32.batteryDischarge - SNAPSHOT_14_32.gridImport,
      soc: BATTERY_POLICY.currentSOC,
      timestamp: SNAPSHOT_14_32.timestamp,
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
