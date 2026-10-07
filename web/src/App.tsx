import { useState, useEffect } from 'react';
import SiteDetail from './SiteDetail';
import BobActions from './BobActions';
import LiveOverview from './LiveOverview';
import AIRecommendations from './AIRecommendations';
import ConnectData from './ConnectData';
import AgentChat from './AgentChat';
import ReviewChanges from './ReviewChanges';
import TestSimulation from './TestSimulation';
import ActivationFlow from './ActivationFlow';
import ActiveMonitoring from './ActiveMonitoring';
import ApprovalReview from './ApprovalReview';
import AskBob from './AskBob';
import LoginScreen from './LoginScreen';
import type { ActionConfig } from './AgentChat';
import { tokenStore } from './api/client';
import { createBrowserRouter, RouterProvider, useLocation, useNavigate } from 'react-router';
import { OperationsProvider, useOperations } from './Operations';
import OperationalPanels, { JourneyNavigation } from './OperationalPanels';
import { transactions } from './Transactions';
import {
  getPortfolioCategories,
  getPortfolioStats,
  getRegisteredSites,
  refreshPortfolioFromBackend,
  subscribePortfolio,
  type RegisteredSite,
} from './services';

const assetPathPrefix = '/assets';
const imgSun = `${assetPathPrefix}/7c8f1.svg`;
const imgWind = `${assetPathPrefix}/8311b.svg`;
const imgBattery = `${assetPathPrefix}/559eb.svg`;
const imgChartBar = `${assetPathPrefix}/d1974.svg`;
const imgArrowRight = `${assetPathPrefix}/814f7.svg`;
const imgStatusDot = `${assetPathPrefix}/572df.svg`;
const imgInfo = `${assetPathPrefix}/edf92.svg`;
const imgBot = `${assetPathPrefix}/06b09.svg`;
const imgSparkles = `${assetPathPrefix}/c9a9e.svg`;
const imgSearch = `${assetPathPrefix}/3177f.svg`;
const imgChevronDown = `${assetPathPrefix}/40ce4.svg`;
const imgSortDesc = `${assetPathPrefix}/9fcb8.svg`;
const imgSolarPanel = `${assetPathPrefix}/2c2ad.svg`;
const imgLiveDot = `${assetPathPrefix}/512fd.svg`;
const imgArrowDown = `${assetPathPrefix}/cc0d0.svg`;
const imgBattery1 = `${assetPathPrefix}/4cd99.svg`;
const imgArrowDownLeft = `${assetPathPrefix}/32198.svg`;
const imgDot = `${assetPathPrefix}/49c35.svg`;
const imgSparkles1 = `${assetPathPrefix}/a467d.svg`;
const imgPulseDot = `${assetPathPrefix}/99944.svg`;
const imgWind1 = `${assetPathPrefix}/69dbb.svg`;
const imgArrowUp = `${assetPathPrefix}/b34ae.svg`;
const imgArrowUpRight = `${assetPathPrefix}/f7ab0.svg`;
const imgCheckCircle = `${assetPathPrefix}/bd3e7.svg`;
const imgCpu = `${assetPathPrefix}/05fbd.svg`;
const imgArrowDown1 = `${assetPathPrefix}/fdc08.svg`;
const imgBatteryLow = `${assetPathPrefix}/80e96.svg`;
const imgArrowDownLeft1 = `${assetPathPrefix}/6331f.svg`;
const imgDot1 = `${assetPathPrefix}/6ac09.svg`;
const imgPulseDot1 = `${assetPathPrefix}/4c3e5.svg`;
const imgCpu1 = `${assetPathPrefix}/3ef2e.svg`;
const imgLiveDot1 = `${assetPathPrefix}/a96dd.svg`;
const imgXCircle = `${assetPathPrefix}/cf7f9.svg`;
const imgDot2 = `${assetPathPrefix}/0812b.svg`;
const imgDownload = `${assetPathPrefix}/ddd14.svg`;
const imgActivity = `${assetPathPrefix}/dd98c.svg`;
const imgCpu2 = `${assetPathPrefix}/cc869.svg`;
const imgUser = `${assetPathPrefix}/2eae2.svg`;
const imgTrendingUp = `${assetPathPrefix}/fd86d.svg`;
const imgSearch1 = `${assetPathPrefix}/9b604.svg`;
const imgCalendar = `${assetPathPrefix}/05414.svg`;
const imgChevronDown1 = `${assetPathPrefix}/8aaef.svg`;
const imgArrowUpRight1 = `${assetPathPrefix}/157e5.svg`;
const imgCpu3 = `${assetPathPrefix}/8b368.svg`;
const imgBatteryCharging = `${assetPathPrefix}/b9f5b.svg`;
const imgArrowDownLeft2 = `${assetPathPrefix}/c3b94.svg`;
const imgChevronLeft = `${assetPathPrefix}/189b1.svg`;
const imgChevronRight = `${assetPathPrefix}/65fcc.svg`;

function getCategoryIcon(icon: string) {
  if (icon === 'wind') return imgWind;
  if (icon === 'battery') return imgBattery;
  return imgSun;
}

function getSiteIcon(type: string) {
  if (type === 'Solar') return imgSolarPanel;
  if (type === 'Wind') return imgWind1;
  return imgCpu;
}

function getGridIcon(status: string) {
  if (status === 'Importing') return imgArrowDownLeft;
  if (status === 'Exporting') return imgArrowUpRight;
  if (status === 'Balanced') return imgCheckCircle;
  return imgXCircle;
}

function getStatusBadge(status: RegisteredSite['status']) {
  switch (status.tone) {
    case 'amber':
      return {
        bg: 'bg-[#fef3c7]',
        text: 'text-[#b26207]',
        dot: imgDot,
        badgeBg: 'bg-[#b26207]',
      };
    case 'green':
      return {
        bg: 'bg-[#defbe6]',
        text: 'text-[#198038]',
        dot: imgLiveDot,
        badgeBg: 'bg-[#198038]',
      };
    case 'blue':
      return {
        bg: 'bg-[#edf5ff]',
        text: 'text-[#0f62fe]',
        dot: imgDot2,
        badgeBg: 'bg-[#0f62fe]',
      };
    case 'red':
      return {
        bg: 'bg-[#fff1f1]',
        text: 'text-[#da1e28]',
        dot: imgDot1,
        badgeBg: 'bg-[#da1e28]',
      };
    default:
      return {
        bg: 'bg-[#f4f4f4]',
        text: 'text-[#525252]',
        dot: imgDot,
        badgeBg: 'bg-[#525252]',
      };
  }
}

function getStatIcon(icon: string) {
  if (icon === 'cpu') return imgCpu2;
  if (icon === 'user') return imgUser;
  if (icon === 'trending-up') return imgTrendingUp;
  return imgActivity;
}

function OperationalRoute() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return Boolean(tokenStore.get() || (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('plug_auth')));
  });
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (tokenStore.get() || (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('plug_auth'))) {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = () => {
    setIsAuthenticated(true);
    if (location.pathname === '/login') {
      navigate('/');
    }
  };

  const handleLogout = () => {
    tokenStore.clear();
    try {
      sessionStorage.removeItem('plug_auth');
    } catch { }
    setIsAuthenticated(false);
    navigate('/login');
  };

  if (!isAuthenticated || location.pathname === '/login') {
    return (
      <div className="h-dvh min-w-0 overflow-y-auto">
        <LoginScreen onLoginSuccess={handleLogin} />
      </div>
    );
  }

  return (
    <div className="flex h-dvh min-w-0 flex-col">
      <JourneyNavigation />
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        <Screens onLogout={handleLogout} />
      </div>
    </div>
  );
}
const router = createBrowserRouter([{ path: '*', Component: OperationalRoute }]);
export default function App() { return <OperationsProvider><RouterProvider router={router} /></OperationsProvider>; }

function Screens({ onLogout }: { onLogout?: () => void }) {
  const [activeFilter, setActiveFilter] = useState<'all' | 'bob' | 'user'>('all');
  const navigate = useNavigate();
  const view = useLocation().pathname.slice(1) || 'dashboard';
  const setView = (next: string) => navigate(next === 'dashboard' ? '/' : `/${next}`);
  const operations = useOperations();
  const { state } = operations;
  const [transactionSearch, setTransactionSearch] = useState('');
  const [siteSearch, setSiteSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState<'attention' | 'name' | 'output'>('attention');
  const [, setPortfolioTick] = useState(0);

  useEffect(() => {
    refreshPortfolioFromBackend();
    const unsubscribe = subscribePortfolio(() => {
      setPortfolioTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  const portfolioCategories = getPortfolioCategories();
  const portfolioStats = getPortfolioStats();
  const registeredSites = getRegisteredSites();

  const filteredSites = registeredSites
    .filter(site => {
      const matchesSearch = `${site.name} ${site.id} ${site.type} ${site.location || ''}`
        .toLowerCase()
        .includes(siteSearch.toLowerCase());
      if (!matchesSearch) return false;
      if (statusFilter === 'all') return true;
      if (statusFilter === 'attention') return site.status.tone === 'amber' || site.status.tone === 'red';
      if (statusFilter === 'operating') return site.status.tone === 'green';
      if (statusFilter === 'maintenance') return site.status.tone === 'blue';
      return true;
    })
    .sort((a, b) => {
      if (sortOrder === 'attention') {
        const toneWeight: Record<string, number> = { amber: 1, red: 2, blue: 3, green: 4 };
        return (toneWeight[a.status.tone] ?? 5) - (toneWeight[b.status.tone] ?? 5);
      }
      if (sortOrder === 'name') return a.name.localeCompare(b.name);
      if (sortOrder === 'output') return b.liveOutputMw - a.liveOutputMw;
      return 0;
    });

  const transactionRows = transactions(state);
  const visibleTransactions = transactionRows.filter(row => (activeFilter === 'all' || (activeFilter === 'bob') === row.initIsBot) && `${row.id} ${row.type} ${row.initiator}`.toLowerCase().includes(transactionSearch.toLowerCase()));
  const actionConfig = state.config;
  const setActionConfig = (config: ActionConfig) => operations.setState(current => ({ ...current, config }));

  if (view === 'askBob') return <AskBob />;
  if (['protected', 'workOrder', 'actionDetails', 'actionTemplate', 'transaction'].includes(view)) return <OperationalPanels page={view} />;

  if (['review', 'test', 'activate'].includes(view) && state.confirmed.length !== 7) return <AgentChat onClose={() => setView('bob')} onComplete={(config) => { setActionConfig(config); setView('review'); }} />;

  if (view === 'approval' && actionConfig) {
    return <ApprovalReview config={state.activeConfig ?? actionConfig} onBack={() => setView('monitoring')} onApprove={() => setView('monitoring')} onReject={() => setView('monitoring')} />;
  }

  if (view === 'monitoring' && actionConfig) {
    if (!state.activated) return <BobActions onClose={() => setView('siteDetail')} onAddAction={() => setView('agentChat')} />;
    return <ActiveMonitoring config={state.activeConfig ?? actionConfig} onBack={() => setView('siteDetail')} onApprovalReview={() => setView('approval')} />;
  }

  if (view === 'activate' && actionConfig) {
    if (!operations.testsPassed) return <TestSimulation config={actionConfig} onBack={() => setView('review')} onComplete={() => { operations.setState(current => ({ ...current, stage: 'Ready to activate' })); setView('activate'); }} />;
    return <ActivationFlow config={actionConfig} onBack={() => setView('test')} onActivated={() => setView('monitoring')} />;
  }

  if (view === 'test' && actionConfig) {
    return <TestSimulation config={actionConfig} onBack={() => setView('review')} onComplete={() => { if (state.activated && JSON.stringify(state.activeConfig) === JSON.stringify(actionConfig) && ['Active', 'Executing', 'Completed'].includes(state.stage)) { setView('monitoring'); return; } operations.setState(current => ({ ...current, stage: 'Ready to activate' })); operations.addAudit('Required simulations passed', 'Seven of seven scenarios passed for the proposed configuration.'); setView('activate'); }} onConfigure={() => setView('agentChat')} onConnectData={() => setView('connectData')} onExit={() => setView('siteDetail')} />;
  }

  if (view === 'review' && actionConfig) {
    return <ReviewChanges config={actionConfig} onBack={() => setView('agentChat')} onEdit={(step) => { operations.edit(step); setView('agentChat'); }} onProceedToTest={() => setView('test')} />;
  }

  if (view === 'agentChat' || view === 'bobSetup' || view === 'bob/setup') {
    return <AgentChat onClose={() => setView('bob')} onComplete={(cfg) => { setActionConfig(cfg); setView('review'); }} />;
  }

  if (view === 'login') {
    return <LoginScreen onLoginSuccess={() => setView('dashboard')} />;
  }

  if (view === 'connectData') {
    return <ConnectData onBack={() => setView('siteDetail')} />;
  }

  if (view === 'aiRec' || view === 'aiRecommendations') {
    return <AIRecommendations onBack={() => setView('dashboard')} onOpenSite={() => setView('siteDetail')} />;
  }

  if (view === 'bob') {
    return <BobActions onClose={() => setView('siteDetail')} onAddAction={() => setView('agentChat')} />;
  }

  if (view === 'liveOverview') {
    return <LiveOverview onBack={() => setView('siteDetail')} onBob={() => setView('bob')} onTabChange={(tab) => setView(tab === 'Live overview' ? 'liveOverview' : 'siteDetail')} />;
  }

  if (view === 'siteDetail' || view === 'aiActions' || view === 'recommendation' || view === 'audit') {
    return <SiteDetail key={view} onBack={() => setView('dashboard')} onLiveOverview={() => setView('liveOverview')} onBob={() => setView('bob')} onConnectData={() => setView('connectData')} onTabChange={(tab) => setView(tab === 'live' ? 'liveOverview' : 'siteDetail')} />;
  }

  return (
    <div className="bg-[#f4f4f4] min-h-screen w-full">
      {/* Header */}
      <header className="bg-[#f4f4f4] border-b border-[#e0e0e0] sticky top-0 z-10">
        <div className="flex flex-wrap gap-4 items-center justify-between px-4 md:px-8 py-4 min-h-[81px]">
          <div className="flex flex-col gap-1">
            <div className="flex gap-2 items-center max-sm:flex-wrap">
              <p className="font-['IBM Plex Sans:Bold'] font-bold text-[#161616] text-[22px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Energy Operations</p>
              <div className="bg-[#e0e0e0] h-4 w-px" />
              <p className="font-['IBM Plex Sans:Medium'] font-medium text-[#525252] text-[14px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Powered by plug.ai</p>
            </div>
            <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#525252] text-[14px] leading-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Portfolio Command Center</p>
          </div>
          <div className="flex gap-6 items-center max-sm:flex-wrap">
            <div className="flex flex-col gap-0.5 items-end">
              <p className="font-['IBM Plex Sans:Medium'] font-medium text-[#8d8d8d] text-[11px] uppercase leading-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Last Updated</p>
              <p className="font-mono font-medium text-[#525252] text-[13px] leading-normal">01 Oct 2026, 14:32 IST</p>
            </div>
            <div
              className="bg-[#fdecef] border border-[#e82127] flex items-center justify-center rounded-full size-10 shrink-0 max-sm:flex-wrap cursor-pointer hover:opacity-90 transition-opacity"
              onClick={onLogout ? onLogout : () => setView('login')}
              title="Admin Account (Click to Sign Out)"
            >
              <p className="font-['IBM Plex Sans:Bold'] font-bold text-[#e82127] text-[14px] leading-normal" style={{ fontVariationSettings: '"wdth" 100' }}>MV</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 md:px-8 py-6 flex flex-col gap-6 min-w-0">
        {/* Page Header */}
        <div className="flex flex-col gap-3">
          <p className="font-['IBM Plex Sans:Light'] font-light text-[#161616] text-[32px] leading-normal" style={{ fontVariationSettings: '"wdth" 100' }}>
            Portfolio overview
          </p>
          <div className="flex gap-4 items-center flex-wrap">
            {portfolioCategories.map(cat => (
              <div key={cat.id} className="bg-[#f4f4f4] border border-[#e0e0e0] px-2 py-1 rounded-[2px]">
                <p className="font-['IBM Plex Sans:Medium'] font-medium text-[#525252] text-[12px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>
                  {cat.title.replace(' Portfolio', '')} ({cat.sitesCount} Sites)
                </p>
              </div>
            ))}
            <div className="bg-[#f4f4f4] border border-[#e0e0e0] px-2 py-1 rounded-[2px]">
              <p className="font-['IBM Plex Sans:Medium'] font-medium text-[#525252] text-[12px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Scope: Kuppam Solar Site</p>
            </div>
          </div>
        </div>

        {/* Portfolio Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          {portfolioCategories.map(card => (
            <div key={card.title} className="bg-white border border-[#e0e0e0] flex flex-col gap-4 p-5 rounded-[2px] flex-1 min-w-0">
              <div className="flex flex-wrap gap-3 items-center justify-between">
                <div className="flex gap-2 items-center max-sm:flex-wrap">
                  <div className="size-[18px] relative shrink-0">
                    <img alt="" className="absolute inset-0 size-full" src={getCategoryIcon(card.icon)} />
                  </div>
                  <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#161616] text-[16px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>{card.title}</p>
                </div>
                <div className="bg-[#f4f4f4] border border-[#e0e0e0] px-2 py-0.5 rounded-[2px]">
                  <p className="font-['IBM Plex Sans:Medium'] font-medium text-[#525252] text-[12px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>{card.sitesCount} Sites</p>
                </div>
              </div>
              <div className="flex items-start justify-between max-sm:flex-wrap">
                <div className="flex flex-col gap-1">
                  <p className="font-['IBM Plex Sans:Medium'] font-medium text-[#8d8d8d] text-[11px] uppercase leading-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Total Capacity</p>
                  <p className="font-mono font-semibold text-[#161616] text-[20px] leading-normal whitespace-nowrap max-sm:whitespace-normal">{card.capacity}</p>
                </div>
                <div className="flex flex-col gap-1 items-end">
                  <p className="font-['IBM Plex Sans:Medium'] font-medium text-[#8d8d8d] text-[11px] uppercase leading-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Portfolio Health</p>
                  <p className="font-mono font-semibold text-[#198038] text-[20px] leading-normal whitespace-nowrap max-sm:whitespace-normal">{card.health}</p>
                </div>
              </div>
              <div className="bg-[#f4f4f4] h-1.5 rounded-[2px] overflow-hidden w-full">
                <div className="bg-[#198038] h-full rounded-[2px]" style={{ width: card.fill }} />
              </div>
            </div>
          ))}
        </div>

        {/* BOB Recommendations */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex gap-2 items-center max-sm:flex-wrap">
              <div className="size-4 relative shrink-0">
                <img alt="" className="absolute inset-0 size-full" src={imgChartBar} />
              </div>
              <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#161616] text-[16px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>BOB Recommendations</p>
            </div>
            <div className="flex gap-1.5 items-center cursor-pointer max-sm:flex-wrap" onClick={() => setView('aiRec')}>
              <p className="font-['IBM Plex Sans:Medium'] font-medium text-[#0f62fe] text-[14px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>View all recommendations</p>
              <div className="size-4 relative shrink-0">
                <img alt="" className="absolute inset-0 size-full" src={imgArrowRight} />
              </div>
            </div>
          </div>
          <div className="bg-white border border-[#e0e0e0] drop-shadow-[0px_4px_8px_rgba(0,0,0,0.03)] flex flex-col gap-5 p-7 rounded-[2px]">
            {/* Card Header */}
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <div className="flex gap-4 items-center max-sm:flex-wrap">
                <div className="flex gap-2 items-center max-sm:flex-wrap">
                  <div className="bg-[#0f62fe] flex items-center justify-center rounded-[2px] size-8 shrink-0 max-sm:flex-wrap">
                    <p className="font-['IBM Plex Sans:Bold'] font-bold text-white text-[12px] leading-normal" style={{ fontVariationSettings: '"wdth" 100' }}>BOB</p>
                  </div>
                  <div className="flex flex-col gap-px">
                    <p className="font-['IBM Plex Sans:Bold'] font-bold text-[#161616] text-[14px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>BOB</p>
                    <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#8d8d8d] text-[12px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>AI Energy Operations</p>
                  </div>
                </div>
                <div className="bg-[#fef3c7] border border-[#f1c21b] flex gap-1.5 items-center px-2 py-1 rounded-[2px] max-sm:flex-wrap">
                  <div className="size-1.5 relative shrink-0">
                    <img alt="" className="absolute inset-0 size-full" src={imgStatusDot} />
                  </div>
                  <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#161616] text-[12px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>{state.approval?.decision === 'pending' ? 'Admin Approval Required' : 'Operational summary'}</p>
                </div>
              </div>
              <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#8d8d8d] text-[13px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Latest analysis · <span className="font-mono">01 Oct 2026, 14:32 IST</span></p>
            </div>
            {/* Briefing Content */}
            <div className="flex flex-col gap-4">
              <p className="font-['IBM Plex Sans:Bold'] font-bold text-[#161616] text-[22px] leading-normal" style={{ fontVariationSettings: '"wdth" 100' }}>{state.approval?.decision === 'pending' ? 'Pending grid-import approval' : 'Kuppam Solar operational summary'}</p>
              <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#525252] text-[14px] leading-[1.5]" style={{ fontVariationSettings: '"wdth" 100' }}>
                Kuppam Solar Site is generating <span className="font-mono font-medium text-[#161616]">38 MW</span>. Demand is <span className="font-mono font-medium text-[#161616]">{operations.flow.demand} MW</span>. Battery 1 discharges <span className="font-mono font-medium text-[#161616]">{operations.flow.battery} MW</span> and grid import is <span className="font-mono font-medium text-[#161616]">{operations.flow.grid} MW</span>. {operations.flow.deficit > 0 ? <><span className="font-mono font-medium text-[#da1e28]">{operations.flow.deficit} MW</span> remains uncovered.</> : "Demand is fully covered."} No surplus is available for export.
              </p>
              <div className="bg-[#f4f4f4] flex flex-col gap-2 p-4 rounded-[2px]">
                <div className="flex gap-1.5 items-center max-sm:flex-wrap">
                  <div className="size-4 relative shrink-0">
                    <img alt="" className="absolute inset-0 size-full" src={imgInfo} />
                  </div>
                  <p className="font-['IBM Plex Sans:Bold'] font-bold text-[#161616] text-[13px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Operational impact</p>
                </div>
                <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#525252] text-[14px] leading-[1.4]" style={{ fontVariationSettings: '"wdth" 100' }}>
                  Battery SOC is <span className="font-mono font-medium text-[#161616]">{operations.flow.soc}%</span>, with <span className="font-mono font-medium text-[#161616]">{((operations.flow.soc - 55) * 0.2).toFixed(1)} MWh</span> usable above the <span className="font-mono">55%</span> reserve. At <span className="font-mono">6 MW</span>, each action is capped at <span className="font-mono">30 minutes</span> / <span className="font-mono">3 MWh</span>; discharge stops at the reserve.
                </p>
              </div>
              <div className="border-l-[3px] border-[#0f62fe] flex flex-col gap-2 pl-4 pr-3 py-3">
                <div className="flex gap-1.5 items-center max-sm:flex-wrap">
                  <div className="size-4 relative shrink-0">
                    <img alt="" className="absolute inset-0 size-full" src={imgBot} />
                  </div>
                  <p className="font-['IBM Plex Sans:Bold'] font-bold text-[#161616] text-[13px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Current response</p>
                </div>
                <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#525252] text-[14px] leading-[1.4]" style={{ fontVariationSettings: '"wdth" 100' }}>
                  Battery 1 discharges <span className="font-mono font-medium text-[#161616]">{operations.flow.battery} MW</span> in the site preview. {state.approval ? `Grid recommendation status: ${state.approval.decision}.` : <>No grid approval is pending at <span className="font-mono">14:32 IST</span>.</>} {state.activated ? "BOB configuration activated." : "New BOB configuration not yet activated."}
                </p>
              </div>
            </div>
            {/* Actions */}
            <div className="flex gap-3 items-center pt-2 max-sm:flex-wrap">
              <button onClick={() => { operations.requestImport(); setView("approval"); }} className="bg-[#0f62fe] flex items-center justify-center px-[18px] py-2.5 rounded-[2px] cursor-pointer hover:bg-[#0043ce] transition-colors max-sm:flex-wrap">
                <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-white text-[14px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Review forecast import</p>
              </button>
              <button onClick={() => setView("askBob")} className="bg-white border border-[#0f62fe] flex gap-2 items-center justify-center px-[18px] min-h-11 rounded-[2px] cursor-pointer hover:bg-[#edf5ff] transition-colors max-sm:flex-wrap">
                <div className="size-3.5 relative shrink-0">
                  <img alt="" className="absolute inset-0 size-full" src={imgSparkles} />
                </div>
                <span className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#0f62fe] text-[14px]" style={{ fontVariationSettings: '"wdth" 100' }}>Ask BOB</span>
              </button>
            </div>
          </div>
        </div>

        {/* Registered Sites Table */}
        <div className="bg-white border border-[#e0e0e0] flex flex-col rounded-[2px] overflow-hidden">
          {/* Table Header */}
          <div className="border-b border-[#e0e0e0] flex flex-wrap gap-4 items-center justify-between pb-4 pt-5 px-6">
            <div className="flex gap-3 items-center max-sm:flex-wrap">
              <p className="font-['IBM Plex Sans:Bold'] font-bold text-[#1a1a1a] text-[18px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Registered Sites</p>
              <div className="bg-[#f4f4f4] border border-[#e0e0e0] px-2 py-0.5 rounded-[2px]">
                <p className="font-['IBM Plex Sans:Medium'] font-medium text-[#525252] text-[12px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>{filteredSites.length} of {registeredSites.length} Sites</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <div className="bg-white border border-[#e0e0e0] flex gap-2 items-center px-2.5 py-1.5 rounded-[2px] w-[200px] max-sm:flex-wrap">
                <div className="size-3.5 relative shrink-0">
                  <img alt="" className="absolute inset-0 size-full" src={imgSearch} />
                </div>
                <input
                  aria-label="Search Sites"
                  value={siteSearch}
                  onChange={e => setSiteSearch(e.target.value)}
                  placeholder="Search Sites"
                  className="font-['IBM Plex Sans:Regular'] font-normal text-[#1a1a1a] text-[13px] leading-normal outline-none bg-transparent w-full placeholder:text-[#999]"
                />
              </div>
              <div className="bg-white border border-[#e0e0e0] flex gap-1.5 items-center px-2.5 py-1.5 rounded-[2px] max-sm:flex-wrap">
                <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#666] text-[13px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Status:</p>
                <select
                  aria-label="Filter sites by status"
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="font-['IBM Plex Sans:Medium'] font-medium text-[#1a1a1a] text-[13px] leading-normal outline-none bg-transparent cursor-pointer"
                >
                  <option value="all">All statuses</option>
                  <option value="attention">Needs Attention</option>
                  <option value="operating">Operating Normally</option>
                  <option value="maintenance">Under Maintenance</option>
                </select>
              </div>
              <div className="bg-white border border-[#e0e0e0] flex gap-1.5 items-center px-2.5 py-1.5 rounded-[2px] max-sm:flex-wrap">
                <div className="size-3.5 relative shrink-0">
                  <img alt="" className="absolute inset-0 size-full" src={imgSortDesc} />
                </div>
                <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#666] text-[13px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Sort:</p>
                <select
                  aria-label="Sort sites"
                  value={sortOrder}
                  onChange={e => setSortOrder(e.target.value as 'attention' | 'name' | 'output')}
                  className="font-['IBM Plex Sans:Medium'] font-medium text-[#1a1a1a] text-[13px] leading-normal outline-none bg-transparent cursor-pointer"
                >
                  <option value="attention">Attention first</option>
                  <option value="name">Site name</option>
                  <option value="output">Live output</option>
                </select>
              </div>
              <button
                type="button"
                onClick={() => { setSiteSearch(''); setStatusFilter('all'); }}
                className="font-['IBM Plex Sans:Medium'] font-medium text-[#0f62fe] text-[13px] leading-normal underline cursor-pointer pl-2"
                style={{ fontVariationSettings: '"wdth" 100' }}
              >
                View all
              </button>
            </div>
          </div>

          <div className="overflow-x-auto" role="region" aria-label="Registered sites table" tabIndex={0}>
            {/* Column Headers */}
            <div className="bg-[#f4f4f4] border-b border-[#e0e0e0] grid grid-cols-[240px_140px_160px_140px_130px_180px_160px_80px] min-w-[1278px] items-center [&>div]:w-auto [&>div]:min-w-0 [&>div:last-child]:justify-start px-6 py-3">
              <div className="w-[240px] font-['IBM Plex Sans:SemiBold'] font-semibold text-[#666] text-[11px] uppercase leading-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Site</div>
              <div className="w-[140px] font-['IBM Plex Sans:SemiBold'] font-semibold text-[#666] text-[11px] uppercase leading-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Live Output</div>
              <div className="w-[160px] font-['IBM Plex Sans:SemiBold'] font-semibold text-[#666] text-[11px] uppercase leading-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Performance</div>
              <div className="w-[140px] font-['IBM Plex Sans:SemiBold'] font-semibold text-[#666] text-[11px] uppercase leading-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Storage</div>
              <div className="w-[130px] font-['IBM Plex Sans:SemiBold'] font-semibold text-[#666] text-[11px] uppercase leading-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Grid Position</div>
              <div className="w-[160px] font-['IBM Plex Sans:SemiBold'] font-semibold text-[#666] text-[11px] uppercase leading-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Status</div>
              <div className="w-[160px] font-['IBM Plex Sans:SemiBold'] font-semibold text-[#666] text-[11px] uppercase leading-normal" style={{ fontVariationSettings: '"wdth" 100' }}>AI Activity</div>
              <div className="w-[80px] font-['IBM Plex Sans:SemiBold'] font-semibold text-[#666] text-[11px] uppercase leading-normal tracking-[0.5px]" style={{ fontVariationSettings: '"wdth" 100' }}>Action</div>
            </div>

            {/* Table Body */}
            <div className="flex flex-col">
              {filteredSites.map((site) => {
                const isKuppam = site.id === 'KUP-SOLAR-001';
                const liveOutput = isKuppam ? operations.flow.solar : site.liveOutputMw;
                const livePercent = Math.round((liveOutput / site.capacityMw) * 100);
                const batterySoc = isKuppam ? Math.round(operations.flow.soc) : site.storage.soc;
                const batteryStatusText = isKuppam
                  ? operations.flow.battery > 0
                    ? `Discharging at ${operations.flow.battery} MW`
                    : operations.flow.battery < 0
                      ? `Charging at ${Math.abs(operations.flow.battery)} MW`
                      : 'Holding reserve (55% floor)'
                  : site.storage.statusText;
                const gridStatus = isKuppam
                  ? 'Importing'
                  : site.grid.status;
                const gridLoadText = isKuppam
                  ? `${operations.flow.grid} MW grid load`
                  : site.grid.loadText;
                const statusObj = isKuppam
                  ? (state.approval?.decision === 'pending'
                    ? { label: 'Pending approval', badgeCount: 1, tone: 'amber' as const }
                    : state.activated
                      ? { label: 'Operating normally', badgeCount: undefined, tone: 'green' as const }
                      : site.status)
                  : site.status;
                const badgeStyle = getStatusBadge(statusObj);

                return (
                  <div
                    key={site.id}
                    className={`${isKuppam ? 'bg-[#f4f4f4]' : 'bg-white'
                      } border-b border-[#e0e0e0] grid grid-cols-[240px_140px_160px_140px_130px_180px_160px_80px] min-w-[1278px] items-center [&>div]:w-auto [&>div]:min-w-0 [&>div:last-child]:justify-start px-6 py-4`}
                  >
                    {/* Site */}
                    <div className="w-[240px] flex gap-3 items-center max-sm:flex-wrap">
                      <div className="bg-[#f4f4f4] p-2 rounded-[2px] shrink-0">
                        <div className="size-[18px] relative">
                          <img alt="" className="absolute inset-0 size-full" src={getSiteIcon(site.type)} />
                        </div>
                      </div>
                      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                        <div className="flex gap-2 items-center max-sm:flex-wrap">
                          <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#1a1a1a] text-[14px] leading-normal truncate" style={{ fontVariationSettings: '"wdth" 100' }}>{site.name}</p>
                          {site.isLive && (
                            <div className="flex gap-1 items-center shrink-0 max-sm:flex-wrap">
                              <div className="size-1.5 relative"><img alt="" className="absolute inset-0 size-full" src={imgLiveDot} /></div>
                              <p className="font-['IBM Plex Sans:Medium'] font-medium text-[#198038] text-[11px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Live</p>
                            </div>
                          )}
                        </div>
                        <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#525252] text-[12px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>
                          {isKuppam ? <>Site ID <span className="font-mono">{site.id}</span> · {site.type}</> : `${site.location || 'Andhra Pradesh'} · ${site.type}`}
                        </p>
                      </div>
                    </div>

                    {/* Live Output */}
                    <div className="w-[140px] flex flex-col gap-1.5">
                      <div className="flex gap-1 items-baseline max-sm:flex-wrap">
                        <p className="font-mono font-bold text-[#161616] text-[14px] leading-normal">{liveOutput} MW</p>
                        <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#525252] text-[11px] leading-normal" style={{ fontVariationSettings: '"wdth" 100' }}>active</p>
                      </div>
                      <div className="bg-[#f4f4f4] h-1 rounded-[2px] overflow-hidden w-20">
                        <div className="bg-[#198038] h-full" style={{ width: `${Math.min(100, livePercent)}%` }} />
                      </div>
                      <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#525252] text-[11px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>of <span className="font-mono">{site.capacityMw} MW</span> capacity</p>
                    </div>

                    {/* Performance */}
                    <div className="w-[160px] flex flex-col gap-0.5">
                      {site.performance ? (
                        <>
                          <p
                            className="font-mono font-semibold text-[14px] leading-normal whitespace-nowrap max-sm:whitespace-normal"
                            style={{
                              color: site.performance.isBelow ? '#b26207' : '#198038',
                            }}
                          >
                            {site.performance.percentOfForecast}% <span className="font-['IBM Plex Sans:Regular'] text-[12px]">of forecast</span>
                          </p>
                          <div className="flex gap-1 items-center max-sm:flex-wrap">
                            <div className="size-3 relative">
                              <img alt="" className="absolute inset-0 size-full" src={site.performance.isBelow ? imgArrowDown : imgArrowUp} />
                            </div>
                            <p
                              className="font-['IBM Plex Sans:Regular'] font-normal text-[12px] leading-normal whitespace-nowrap max-sm:whitespace-normal"
                              style={{
                                color: site.performance.isBelow ? '#b26207' : '#198038',
                                fontVariationSettings: '"wdth" 100'
                              }}
                            >
                              {site.performance.deviationText}
                            </p>
                          </div>
                        </>
                      ) : (
                        <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#525252] text-[13px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Unavailable</p>
                      )}
                    </div>

                    {/* Storage */}
                    <div className="w-[140px] flex flex-col gap-0.5">
                      {batterySoc !== null ? (
                        <>
                          <div className="flex gap-1.5 items-center max-sm:flex-wrap">
                            <div className="size-3.5 relative">
                              <img alt="" className="absolute inset-0 size-full" src={batterySoc < 30 ? imgBatteryLow : imgBattery1} />
                            </div>
                            <p className="font-mono font-semibold text-[#161616] text-[14px] leading-normal">{batterySoc}%</p>
                          </div>
                          <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#525252] text-[12px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>{batteryStatusText}</p>
                        </>
                      ) : (
                        <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#525252] text-[13px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>{batteryStatusText || 'No battery'}</p>
                      )}
                    </div>

                    {/* Grid Position */}
                    <div className="w-[130px] flex flex-col gap-0.5">
                      <div className="flex gap-1.5 items-center max-sm:flex-wrap">
                        <div className="size-3.5 relative">
                          <img alt="" className="absolute inset-0 size-full" src={getGridIcon(gridStatus)} />
                        </div>
                        <p className="font-['IBM Plex Sans:Medium'] font-medium text-[#161616] text-[13px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>{gridStatus}</p>
                      </div>
                      <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#525252] text-[12px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>{gridLoadText}</p>
                    </div>

                    {/* Status */}
                    <div className="w-[160px]">
                      <div className={`${badgeStyle.bg} flex gap-1.5 h-6 items-center px-2 py-1 rounded-[2px] w-fit max-sm:flex-wrap`}>
                        <div className="size-1.5 relative">
                          <img alt="" className="absolute inset-0 size-full" src={badgeStyle.dot} />
                        </div>
                        <p className={`font-['IBM Plex Sans:Medium'] font-medium ${badgeStyle.text} text-[12px] leading-normal whitespace-nowrap max-sm:whitespace-normal`} style={{ fontVariationSettings: '"wdth" 100' }}>{statusObj.label}</p>
                        {statusObj.badgeCount && (
                          <div className={`${badgeStyle.badgeBg} flex items-center justify-center rounded-full size-3.5 max-sm:flex-wrap`}>
                            <p className="font-['IBM Plex Sans:Bold'] font-bold text-white text-[9px] leading-normal" style={{ fontVariationSettings: '"wdth" 100' }}>{statusObj.badgeCount}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* AI Activity */}
                    <div className="w-[160px] flex gap-2 items-center max-sm:flex-wrap">
                      <div className="size-3.5 relative">
                        <img alt="" className="absolute inset-0 size-full" src={imgSparkles1} />
                      </div>
                      <div className="flex gap-1.5 items-center max-sm:flex-wrap">
                        <p
                          className={`font-['IBM Plex Sans:Medium'] font-medium ${site.aiActivity.isPulsing ? 'text-[#0f62fe]' : 'text-[#525252]'} text-[13px] leading-normal whitespace-nowrap max-sm:whitespace-normal`}
                          style={{ fontVariationSettings: '"wdth" 100' }}
                        >
                          {site.aiActivity.text}
                        </p>
                        {site.aiActivity.isPulsing && (
                          <div className="size-[5px] relative">
                            <img alt="" className="absolute inset-0 size-full" src={imgPulseDot} />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action */}
                    <div className="w-[80px] flex items-center justify-center max-sm:flex-wrap">
                      <p
                        className="font-['IBM Plex Sans:Medium'] font-medium text-[#0f62fe] text-[13px] leading-normal cursor-pointer whitespace-nowrap max-sm:whitespace-normal hover:text-[#0043ce] hover:underline"
                        onClick={() => setView('siteDetail')}
                        style={{ fontVariationSettings: '"wdth" 100' }}
                      >
                        Open site
                      </p>
                    </div>
                  </div>
                );
              })}


            </div>
          </div>
        </div>

        {/* Transaction History */}
        <div className="bg-white border border-[#e0e0e0] flex flex-col gap-6 p-4 md:p-8 rounded-[2px] min-w-0">
          {/* Header Row */}
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex flex-col gap-1">
              <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#161616] text-[22px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Transaction History</p>
              <div className="bg-[#f4f4f4] border border-[#e0e0e0] px-2.5 py-1 w-fit">
                <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#525252] text-[12px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>All Sites</p>
              </div>
              <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#525252] text-[14px] leading-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Monitor and manage system-automated agent and user-initiated energy exchanges</p>
            </div>
            <button className="bg-[#0f62fe] border border-[#0f62fe] flex gap-2 items-center px-4 py-2.5 cursor-pointer hover:bg-[#0043ce] transition-colors shrink-0 max-sm:flex-wrap">
              <div className="size-4 relative shrink-0"><img alt="" className="absolute inset-0 size-full" src={imgDownload} /></div>
              <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-white text-[14px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Export CSV</p>
            </button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
            {portfolioStats.map(stat => (
              <div key={stat.label} className="bg-white border-l-4 border-[#e0e0e0] flex flex-col gap-3 p-5 flex-1 min-w-0">
                <div className="flex flex-wrap gap-3 items-center justify-between">
                  <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#8d8d8d] text-[12px] tracking-[0.32px] uppercase leading-normal" style={{ fontVariationSettings: '"wdth" 100' }}>{stat.label}</p>
                  <div className="bg-[#f4f4f4] p-2 shrink-0">
                    <div className="size-4 relative"><img alt="" className="absolute inset-0 size-full" src={getStatIcon(stat.icon)} /></div>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="font-mono font-semibold text-[#161616] text-[24px] leading-normal whitespace-nowrap max-sm:whitespace-normal">{stat.value}</p>
                  <div className="flex gap-1 items-center text-[12px] max-sm:flex-wrap">
                    <p className="font-mono font-semibold leading-normal" style={{ color: stat.changeColor }}>{stat.change}</p>
                    <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#525252] leading-normal" style={{ fontVariationSettings: '"wdth" 100' }}>vs last month</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Filter Bar */}
          <div className="bg-white border border-[#e0e0e0] flex flex-wrap gap-4 items-center justify-between p-4">
            <div className="flex gap-4 items-center flex-wrap">
              <div className="bg-[#f4f4f4] border-b border-[#e0e0e0] flex gap-2 items-center px-3 py-2.5 w-[240px] max-sm:flex-wrap">
                <div className="size-4 relative shrink-0"><img alt="" className="absolute inset-0 size-full" src={imgSearch1} /></div>
                <input aria-label="Search transactions" value={transactionSearch} onChange={event => setTransactionSearch(event.target.value)} placeholder="Search transaction ID..." className="min-w-0 flex-1 text-sm outline-none font-mono" />
              </div>
              <div className="bg-[#f4f4f4] border border-[#e0e0e0] flex items-start p-[3px] max-sm:flex-wrap">
                {(['all', 'bob', 'user'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setActiveFilter(filter)}
                    className={`flex items-start px-4 py-2 cursor-pointer transition-colors ${activeFilter === filter ? 'bg-[#161616]' : 'bg-[#f4f4f4] hover:bg-[#e8e8e8]'}`}
                  >
                    <p className={`font-['IBM Plex Sans:${activeFilter === filter ? 'SemiBold' : 'Medium'}'] ${activeFilter === filter ? 'font-semibold text-white' : 'font-medium text-[#525252]'} text-[13px] leading-normal whitespace-nowrap max-sm:whitespace-normal`} style={{ fontVariationSettings: '"wdth" 100' }}>
                      {filter === 'all' ? 'All' : filter === 'bob' ? 'BOB Agent' : 'User Made'}
                    </p>
                  </button>
                ))}
              </div>
              <div className="bg-white border-b border-[#e0e0e0] flex items-center px-3.5 py-2.5 max-sm:flex-wrap">
                <p className="font-['IBM Plex Sans:Medium'] font-medium text-[#525252] text-[14px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Kuppam Solar Site</p>
              </div>
              <div className="bg-white border-b border-[#e0e0e0] flex gap-2 items-center px-3.5 py-2.5 max-sm:flex-wrap">
                <div className="size-3.5 relative shrink-0"><img alt="" className="absolute inset-0 size-full" src={imgCalendar} /></div>
                <p className="font-['IBM Plex Sans:Medium'] font-medium text-[#525252] text-[14px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}><span className="font-mono">01 Oct 2026</span> · IST</p>
                <div className="size-3.5 relative shrink-0"><img alt="" className="absolute inset-0 size-full" src={imgChevronDown1} /></div>
              </div>
            </div>
            <div className="bg-white border-b border-[#e0e0e0] flex gap-2 items-center px-3.5 py-2.5 shrink-0 max-sm:flex-wrap">
              <p className="font-['IBM Plex Sans:Medium'] font-medium text-[#525252] text-[14px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>All Statuses</p>
              <div className="size-3.5 relative shrink-0"><img alt="" className="absolute inset-0 size-full" src={imgChevronDown1} /></div>
            </div>
          </div>

          {/* Transaction Table */}
          <div className="border border-[#e0e0e0] flex flex-col overflow-x-auto" role="region" aria-label="Transaction history table" tabIndex={0}>
            {/* Table Header */}
            <div className="bg-[#e0e0e0] border-b border-[#e0e0e0] grid grid-cols-[140px_minmax(180px,1.4fr)_160px_180px_130px_130px_120px_80px] min-w-[1280px] gap-4 [&>div]:w-auto [&>p]:w-auto items-center px-6 py-3.5">
              {[
                { label: 'Date', w: 'w-[140px]' },
                { label: 'Site', w: 'w-[220px]' },
                { label: 'Type', w: 'w-[160px]' },
                { label: 'Initiated By', w: 'w-[180px]' },
                { label: 'Amount', w: 'w-[130px]' },
                { label: 'Revenue', w: 'w-[130px]' },
                { label: 'Status', w: 'w-[120px]' },
              ].map(col => (
                <p key={col.label} className={`font-['IBM Plex Sans:SemiBold'] font-semibold text-[#161616] text-[12px] tracking-[0.32px] uppercase leading-normal ${col.w} shrink-0`} style={{ fontVariationSettings: '"wdth" 100' }}>{col.label}</p>
              ))}
              <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#161616] text-[12px] tracking-[0.32px] uppercase leading-normal flex-1 text-right max-sm:flex-wrap" style={{ fontVariationSettings: '"wdth" 100' }}>Action</p>
            </div>

            {/* Table Rows */}
            {visibleTransactions.map((row, i) => (
              <div key={i} className={`${row.bg} border-b border-[#e0e0e0] grid grid-cols-[140px_minmax(180px,1.4fr)_160px_180px_130px_130px_120px_80px] min-w-[1280px] gap-4 [&>div]:w-auto [&>p]:w-auto items-center px-6 py-4`}>
                <div className="w-[140px] shrink-0">
                  <p className="font-mono font-medium text-[#161616] text-[13px] leading-normal whitespace-nowrap max-sm:whitespace-normal">{row.date}</p>
                </div>
                <div className="w-[220px] shrink-0">
                  <p className="font-['IBM Plex Sans:Medium'] font-medium text-[#161616] text-[14px] leading-normal overflow-hidden text-ellipsis whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Kuppam Solar Site</p>
                </div>
                <div className="w-[160px] shrink-0 flex gap-2 items-center max-sm:flex-wrap">
                  <div className="size-3.5 relative shrink-0"><img alt="" className="absolute inset-0 size-full" src={row.typeIcon} /></div>
                  <p className="font-['IBM Plex Sans:Medium'] font-medium text-[#161616] text-[14px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>{row.type}</p>
                </div>
                <div className="w-[180px] shrink-0 flex gap-2 items-center max-sm:flex-wrap">
                  {row.initIsBot ? (
                    <div className="p-1 shrink-0" style={{ background: row.initBg }}>
                      <div className="size-3.5 relative"><img alt="" className="absolute inset-0 size-full" src={row.initIcon} /></div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center size-[22px] shrink-0 max-sm:flex-wrap" style={{ background: row.initBg }}>
                      <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#161616] text-[10px] leading-normal" style={{ fontVariationSettings: '"wdth" 100' }}>{row.initInitials}</p>
                    </div>
                  )}
                  <p className="font-['IBM Plex Sans:Medium'] font-medium text-[14px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ color: row.initColor, fontVariationSettings: '"wdth" 100' }}>{row.initiator}</p>
                </div>
                <div className="w-[130px] shrink-0">
                  <p className="font-mono font-semibold text-[#161616] text-[14px] leading-normal whitespace-nowrap max-sm:whitespace-normal">{row.amount}</p>
                </div>
                <div className="w-[130px] shrink-0">
                  <p className="font-mono font-semibold text-[14px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ color: row.revColor }}>{row.revenue}</p>
                </div>
                <div className="w-[120px] shrink-0">
                  <div className="flex items-start px-2.5 py-1 w-fit rounded-[2px] max-sm:flex-wrap" style={{ background: row.statusBg }}>
                    <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[12px] uppercase leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ color: row.statusColor, fontVariationSettings: '"wdth" 100' }}>{row.status}</p>
                  </div>
                </div>
                <div className="flex-1 flex items-start justify-end max-sm:flex-wrap">
                  <button onClick={() => navigate("/transaction?id=" + row.id)} className="min-h-11 bg-white border border-[#e0e0e0] flex items-start px-3 py-1.5 rounded-[2px] cursor-pointer hover:bg-[#edf5ff] hover:border-[#0f62fe] transition-colors max-sm:flex-wrap">
                    <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#0f62fe] text-[14px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Details</p>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex flex-wrap gap-4 items-center justify-between pt-2">
            <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#525252] text-[14px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>
              Showing{' '}
              <span className="font-mono font-semibold text-[#161616]">{visibleTransactions.length ? `1-${visibleTransactions.length}` : "0"}</span>
              {' '}of{' '}
              <span className="font-mono font-semibold text-[#161616]">{visibleTransactions.length}</span>
              {' '}transactions
            </p>
            <p className="text-xs text-[#6f6f6f]">All available preview records shown. Earlier rows are historical; no energy is recorded for proposed or blocked imports.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
