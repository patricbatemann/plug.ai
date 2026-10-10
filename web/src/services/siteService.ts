import siteData from '../mock/siteDetails.json';

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
