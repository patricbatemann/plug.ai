export interface ActionConfig {
  objective: string
  battery: string
  trigger: {
    deficitMW: number
    delayMin: number
  }
  limits: {
    autoMaxMW: number
    reserveSOC: number
    maxDuration: number
    maxEnergyMWh: number
  }
  automation: {
    approvalAboveMW: number
    approvalExpiryMin: number
    autoStart: boolean
  }
  recovery: string
  notifications: string[]
}

export const DEFAULT_CONFIG: ActionConfig = {
  objective: "reliability",
  battery: "battery1",
  trigger: { deficitMW: 3, delayMin: 5 },
  limits: { autoMaxMW: 6, reserveSOC: 55, maxDuration: 30, maxEnergyMWh: 3 },
  automation: { approvalAboveMW: 6, approvalExpiryMin: 10, autoStart: true },
  recovery: "notify-and-hold",
  notifications: ["sms", "email"],
}
