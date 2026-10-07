import portfolioData from '../mock/portfolio.json';
import { portfolioApi } from '../api/client';

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

let cachedCategories: PortfolioCategory[] = portfolioData.categories as PortfolioCategory[];
let cachedStats: PortfolioStat[] = portfolioData.stats as PortfolioStat[];
let cachedSites: RegisteredSite[] = portfolioData.registeredSites as unknown as RegisteredSite[];
const subscribers: Set<() => void> = new Set();

export function subscribePortfolio(callback: () => void): () => void {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

export async function refreshPortfolioFromBackend(): Promise<void> {
  try {
    const portfolio = await portfolioApi.get();
    if (portfolio && Array.isArray(portfolio.sites)) {
      cachedSites = cachedSites.map((mockSite) => {
        const found = portfolio.sites.find((s) => s.code === mockSite.id);
        if (!found) return mockSite;
        return {
          ...mockSite,
          name: found.name || mockSite.name,
          type: found.kind === 'solar' ? 'Solar' : found.kind === 'wind' ? 'Wind' : 'Hybrid',
          location: found.location || mockSite.location,
          capacityMw: found.generation_mw || mockSite.capacityMw,
        };
      });

      if (portfolio.totals) {
        cachedCategories = [
          {
            id: 'solar',
            icon: 'sun',
            title: 'Solar Generation',
            sites: `${portfolio.sites.filter((s) => s.kind === 'solar' || s.kind === 'hybrid').length} Sites active`,
            sitesCount: portfolio.sites.filter((s) => s.kind === 'solar' || s.kind === 'hybrid').length,
            capacity: `${portfolio.totals.solar_mw} MW`,
            health: '98.2% operating',
            fill: '#0f62fe',
          },
          {
            id: 'wind',
            icon: 'wind',
            title: 'Wind Generation',
            sites: `${portfolio.sites.filter((s) => s.kind === 'wind').length} Sites active`,
            sitesCount: portfolio.sites.filter((s) => s.kind === 'wind').length,
            capacity: `${portfolio.totals.wind_mw} MW`,
            health: '95.8% operating',
            fill: '#0043ce',
          },
          {
            id: 'battery',
            icon: 'battery',
            title: 'Battery Storage',
            sites: `${portfolio.sites.filter((s) => s.battery_mwh > 0).length} BESS units`,
            sitesCount: portfolio.sites.filter((s) => s.battery_mwh > 0).length,
            capacity: `${portfolio.totals.battery_mw} MW / ${portfolio.totals.battery_mwh} MWh`,
            health: 'SOC 74% avg',
            fill: '#198038',
          },
        ];
      }
      subscribers.forEach((cb) => cb());
    }
  } catch {
    // If backend unavailable or unauthenticated, keep mock data
  }
}

/**
 * Service functions for Portfolio data.
 * When real APIs are ready, these fetch from backend endpoints with fallback.
 */
export function getPortfolioCategories(): PortfolioCategory[] {
  return cachedCategories;
}

export function getPortfolioStats(): PortfolioStat[] {
  return cachedStats;
}

export function getRegisteredSites(): RegisteredSite[] {
  return cachedSites;
}

export function getRegisteredSiteById(id: string): RegisteredSite | undefined {
  return cachedSites.find((site) => site.id === id);
}
