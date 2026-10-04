import portfolioData from '../mock/portfolio.json';

export interface PortfolioCategory {
  id: string;
  icon: string;
  title: string;
  sites: string;
  sitesCount: number;
  capacity: string;
  health: string;
  fill: string;
}

export interface PortfolioStat {
  id: string;
  label: string;
  value: string;
  change: string;
  changeColor: string;
  changeDir: 'up' | 'down';
  icon: string;
}

export interface SitePerformance {
  percentOfForecast: number;
  isBelow: boolean;
  deviationText: string;
}

export interface SiteStorage {
  soc: number | null;
  statusText: string;
}

export interface SiteGrid {
  status: 'Importing' | 'Exporting' | 'Balanced' | 'Disconnected' | string;
  loadText: string;
}

export interface RegisteredSiteStatus {
  label: string;
  badgeCount?: number;
  tone: 'amber' | 'green' | 'blue' | 'red' | 'gray';
}

export interface SiteAiActivity {
  text: string;
  isPulsing: boolean;
}

export interface RegisteredSite {
  id: string;
  name: string;
  type: string;
  icon: string;
  location: string;
  isLive: boolean;
  liveOutputMw: number;
  capacityMw: number;
  performance?: SitePerformance;
  storage: SiteStorage;
  grid: SiteGrid;
  status: RegisteredSiteStatus;
  aiActivity: SiteAiActivity;
  isPrimaryFocus: boolean;
}

/**
 * Service functions for Portfolio data.
 * When real APIs are ready, these can fetch from backend endpoints (e.g. `/api/portfolio/...`).
 */
export function getPortfolioCategories(): PortfolioCategory[] {
  return portfolioData.categories as PortfolioCategory[];
}

export function getPortfolioStats(): PortfolioStat[] {
  return portfolioData.stats as PortfolioStat[];
}

export function getRegisteredSites(): RegisteredSite[] {
  return portfolioData.registeredSites as unknown as RegisteredSite[];
}

export function getRegisteredSiteById(id: string): RegisteredSite | undefined {
  return (portfolioData.registeredSites as unknown as RegisteredSite[]).find(site => site.id === id);
}
