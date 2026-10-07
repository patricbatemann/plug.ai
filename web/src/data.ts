// Canonical operational data for Kuppam Solar Site – 1 Oct 2026, 14:32 IST
import { getSiteDetails, getOperationalSnapshots } from './services/siteService';
import { getBatteryPolicy, getRequiredSimulations, getConfigSteps } from './services/actionService';

const siteInfo = getSiteDetails();
export const SITE = {
  id: siteInfo.id,
  name: siteInfo.shortName,
  location: siteInfo.location,
  capacity: siteInfo.capacityMW,
};

const snapshots = getOperationalSnapshots();
export const SNAPSHOT_14_32 = {
  timestamp: snapshots['14_32'].timestamp,
  solar: snapshots['14_32'].solarMW,
  demand: snapshots['14_32'].demandMW,
  batteryDischarge: snapshots['14_32'].batteryDischargeMW,
  gridImport: snapshots['14_32'].gridImportMW,
};

export const SNAPSHOT_14_50 = {
  timestamp: snapshots['14_50'].timestamp,
  solar: snapshots['14_50'].solarMW,
  demand: snapshots['14_50'].demandMW,
  batteryDischarge: snapshots['14_50'].batteryDischargeMW,
  gridImportProposed: snapshots['14_50'].gridImportProposedMW,
  deficit: snapshots['14_50'].deficitMW,
};

const policy = getBatteryPolicy();
export const BATTERY_POLICY = {
  startThresholdMW: policy.startThresholdMW,
  startDelay: policy.startDelayMinutes,
  startSOC: policy.startSOC,
  reserveSOC: policy.reserveSOC,
  emergencyFloorSOC: policy.emergencyFloorSOC,
  autoMaxMW: policy.autoMaxMW,
  equipmentMaxMW: policy.equipmentMaxMW,
  approvalAboveMW: policy.approvalAboveMW,
  maxDuration: policy.maxDurationMinutes,
  maxEnergyMWh: policy.maxEnergyMWh,
  approvalExpiryMinutes: policy.approvalExpiryMinutes,
  currentSOC: policy.currentSOC,
  totalCapacityMWh: policy.totalCapacityMWh,
  usableMWh: policy.usableMWh,
  runtimeMin: policy.runtimeMin,
  health: policy.health,
  name: policy.name,
};

export type ActionState =
  | 'Draft'
  | 'Configuring'
  | 'Ready to test'
  | 'Testing'
  | 'Tested'
  | 'Ready to activate'
  | 'Active'
  | 'Executing'
  | 'Awaiting approval'
  | 'Completed'
  | 'Rejected'
  | 'Expired'
  | 'Failed';

export const STATE_COLOR: Record<ActionState, { bg: string; text: string }> = {
  'Draft':              { bg: '#f4f4f4',   text: '#525252' },
  'Configuring':        { bg: '#e8f1ff',   text: '#0f62fe' },
  'Ready to test':      { bg: '#fff8e1',   text: '#8a3800' },
  'Testing':            { bg: '#e8f1ff',   text: '#0f62fe' },
  'Tested':             { bg: '#e6f4ea',   text: '#1a7f37' },
  'Ready to activate':  { bg: '#e6f4ea',   text: '#1a7f37' },
  'Active':             { bg: '#e6f4ea',   text: '#1a7f37' },
  'Executing':          { bg: '#e8f1ff',   text: '#0f62fe' },
  'Awaiting approval':  { bg: '#fff8e1',   text: '#8a3800' },
  'Completed':          { bg: '#e6f4ea',   text: '#1a7f37' },
  'Rejected':           { bg: '#fef2f2',   text: '#dc2626' },
  'Expired':            { bg: '#f4f4f4',   text: '#525252' },
  'Failed':             { bg: '#fef2f2',   text: '#dc2626' },
};

export const REQUIRED_SIMULATIONS = getRequiredSimulations();
export const CONFIG_STEPS = getConfigSteps();
