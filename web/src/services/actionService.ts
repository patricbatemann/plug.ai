import actionTemplatesData from '../mock/actionTemplates.json';
import batteryPolicyData from '../mock/batteryPolicy.json';

export interface RequiredSimulation {
  id: string;
  label: string;
  desc: string;
}

/**
 * Required simulations, configuration steps and the battery policy.
 */
export function getRequiredSimulations(): RequiredSimulation[] {
  return actionTemplatesData.requiredSimulations;
}

export function getConfigSteps(): string[] {
  return actionTemplatesData.configSteps;
}

export function getBatteryPolicy() {
  return batteryPolicyData;
}
