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

      // Counts and capacities come from the backend; labels, icons and bar fills stay as designed.
      const { sites, totals } = portfolio;
      const live: Record<string, { count: number; capacity: string }> = {
        solar: { count: sites.filter((s) => s.kind === 'solar' || s.kind === 'hybrid').length, capacity: `${totals.solar_mw} MW` },
        wind: { count: sites.filter((s) => s.kind === 'wind').length, capacity: `${totals.wind_mw} MW` },
        battery: { count: sites.filter((s) => s.battery_mwh > 0).length, capacity: `${totals.battery_mwh} MWh` },
      };
      cachedCategories = cachedCategories.map((category) => {
        const found = live[category.id];
        return found
          ? { ...category, sites: `${found.count} Sites`, sitesCount: found.count, capacity: found.capacity }
          : category;
      });
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
