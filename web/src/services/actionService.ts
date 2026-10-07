import actionTemplatesData from '../mock/actionTemplates.json';
import batteryPolicyData from '../mock/batteryPolicy.json';

export interface ActionTemplate {
  id: string;
  title: string;
  description: string;
  count: number;
  triggers: string[];
  rules: string[];
  activity: string[][];
  summary: string;
}

export interface RequiredSimulation {
  id: string;
  label: string;
  desc: string;
}

export interface PriorityOption {
  id: string;
  label: string;
  recommended: boolean;
}

export interface RecoveryOption {
  id: string;
  label: string;
  recommended: boolean;
}

/**
 * Service functions for BOB Action templates, required simulations, and battery policies.
 */
export function getActionTemplates(): ActionTemplate[] {
  return actionTemplatesData.templates as ActionTemplate[];
}

export function getActionTemplateById(id: string): ActionTemplate | undefined {
  return (actionTemplatesData.templates as ActionTemplate[]).find(template => template.id === id);
}

export function getRequiredSimulations(): RequiredSimulation[] {
  return actionTemplatesData.requiredSimulations;
}

export function getConfigSteps(): string[] {
  return actionTemplatesData.configSteps;
}

export function getPriorityOptions(): PriorityOption[] {
  return actionTemplatesData.priorities;
}

export function getRecoveryOptions(): RecoveryOption[] {
  return actionTemplatesData.recoveryOptions;
}

export function getNotificationChannels(): { id: string; label: string }[] {
  return actionTemplatesData.notificationChannels;
}

export function getBatteryPolicy() {
  return batteryPolicyData;
}
