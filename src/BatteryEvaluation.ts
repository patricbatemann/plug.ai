import type { ActionConfig } from "./ActionConfig"
import { policyErrors } from "./Operations"

export interface BatteryInputs {
  solar: number
  demand: number
  soc: number
  requestedMW: number
  sustainedMinutes: number
  elapsedMinutes: number
  energyMWh: number
  temperature: number
  telemetrySeconds: number
  available: boolean
  maintenance: boolean
  healthNormal: boolean
  safetyPassed: boolean
  running: boolean
}
export function evaluateBattery(
  config: ActionConfig,
  inputs: BatteryInputs,
): "blocked" | "stopped" | "awaiting approval" | "executing" | "waiting" {
  if (
    [
      inputs.solar,
      inputs.demand,
      inputs.soc,
      inputs.requestedMW,
      inputs.sustainedMinutes,
      inputs.elapsedMinutes,
      inputs.energyMWh,
      inputs.temperature,
      inputs.telemetrySeconds,
    ].some((value) => !Number.isFinite(value)) ||
    inputs.soc < 0 ||
    inputs.soc > 100 ||
    inputs.telemetrySeconds < 0
  )
    return "blocked"
  if (
    policyErrors(config).length ||
    !inputs.available ||
    inputs.maintenance ||
    !inputs.healthNormal ||
    !inputs.safetyPassed ||
    inputs.telemetrySeconds > 120 ||
    inputs.temperature > 45 ||
    inputs.requestedMW > 8 ||
    inputs.requestedMW <= 0
  )
    return "blocked"
  if (
    inputs.running &&
    (inputs.soc <= config.limits.reserveSOC ||
      inputs.elapsedMinutes >= config.limits.maxDuration ||
      inputs.energyMWh >= config.limits.maxEnergyMWh)
  )
    return "stopped"
  if (!inputs.running && inputs.soc <= 60) return "blocked"
  if (
    inputs.demand - inputs.solar <= config.trigger.deficitMW ||
    inputs.sustainedMinutes < config.trigger.delayMin
  )
    return "waiting"
  if (inputs.requestedMW > inputs.demand - inputs.solar) return "blocked"
  if (inputs.requestedMW > 6) return "awaiting approval"
  if (inputs.requestedMW > config.limits.autoMaxMW) return "blocked"
  return "executing"
}
