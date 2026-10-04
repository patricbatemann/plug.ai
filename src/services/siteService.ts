import siteData from '../mock/siteDetails.json';
import telemetryData from '../mock/telemetry.json';

export interface SiteInfo {
  id: string;
  name: string;
  shortName: string;
  location: string;
  region: string;
  commissioned: string;
  capacityMW: number;
  batteryCapacityMWh: number;
  batteryMaxOutputMW: number;
  status: string;
  technology: string;
  mode: string;
  dataMode: string;
}

export interface SiteAsset {
  id: string;
  name: string;
  type: string;
  capacity: string;
  status: string;
  statusTone: string;
  monitoring: string;
  remote: string;
  bobPermission: string | null;
  bobActionLink: string | null;
}

export interface MonitoringFeed {
  name: string;
  source: string;
  ageSeconds: number;
}

export interface WeatherTelemetry {
  condition: string;
  ambientTemp: string;
  moduleTemp: string;
  solarIrradiance: string;
  windSpeed: string;
  humidity: string;
  cloudCover: string;
  uvIndex: string;
  uvLevel: string;
  forecastTrend: string;
  lastUpdated: string;
}

export interface GenerationCondition {
  label: string;
  value: string;
  valueClass: string;
}

/**
 * Service functions for Site Details and Telemetry.
 * Swap with backend API calls when live endpoints are available.
 */
export function getSiteDetails(siteId: string = 'KUP-SOLAR-001'): SiteInfo {
  return siteData.site;
}

export function getSiteAssets(siteId: string = 'KUP-SOLAR-001'): SiteAsset[] {
  return siteData.assets;
}

export function getMonitoringFeeds(siteId: string = 'KUP-SOLAR-001'): MonitoringFeed[] {
  return siteData.monitoringFeeds;
}

export function getTechnicalSpecs(siteId: string = 'KUP-SOLAR-001') {
  return siteData.technicalSpecs;
}

export function getWeatherTelemetry(siteId: string = 'KUP-SOLAR-001'): WeatherTelemetry {
  return telemetryData.weather;
}

export function getGenerationConditions(siteId: string = 'KUP-SOLAR-001'): GenerationCondition[] {
  return telemetryData.generationConditions;
}

export function getActiveAlerts(siteId: string = 'KUP-SOLAR-001'): string[] {
  return telemetryData.activeAlerts;
}

export function getOperationalSnapshots() {
  return telemetryData.snapshots;
}
