import { useState } from 'react';
import { mw } from './format';
import { SITE } from './data';
import SiteDetail from './SiteDetail';
import BobActions from './BobActions';
import LiveOverview from './LiveOverview';
import AIRecommendations, { TopRecommendations } from './AIRecommendations';
import ConnectData from './ConnectData';
import AgentChat from './AgentChat';
import { ActivateConfig, ReviewConfig, TestConfig } from './ConfigJourney';
import ActiveMonitoring from './ActiveMonitoring';
import ApprovalReview from './ApprovalReview';
import AskBob from './AskBob';
import LoginScreen from './LoginScreen';
import { signOut, tokenStore } from './api/client';
import { useProfile } from './auth/user';
import { createBrowserRouter, RouterProvider, useLocation, useNavigate } from 'react-router';
import OperationalPanels, { JourneyNavigation } from './OperationalPanels';
import { usePortfolio, type SiteRow, type Tone } from './portfolio';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const assetPathPrefix = '/assets';
const imgSun = `${assetPathPrefix}/7c8f1.svg`;
const imgWind = `${assetPathPrefix}/8311b.svg`;
const imgBattery = `${assetPathPrefix}/559eb.svg`;
const imgChartBar = `${assetPathPrefix}/d1974.svg`;
const imgArrowRight = `${assetPathPrefix}/814f7.svg`;
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

function getStatusBadge(status: SiteRow['status']) {
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

const TONE_TAG: Record<Tone, string> = {
  green: 'bg-[#defbe6] text-[#198038]',
  blue: 'bg-[#edf5ff] text-[#0f62fe]',
  amber: 'bg-[#fef3c7] text-[#b26207]',
  red: 'bg-[#fff1f1] text-[#da1e28]',
  gray: 'bg-[#f4f4f4] text-[#525252]',
};

function getStatIcon(icon: string) {
  if (icon === 'cpu') return imgCpu2;
  if (icon === 'user') return imgUser;
  if (icon === 'trending-up') return imgTrendingUp;
  return imgActivity;
}

function OperationalRoute() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(tokenStore.get()));
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogin = () => {
    setIsAuthenticated(true);
    if (location.pathname === '/login') {
      navigate('/');
    }
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
        <Screens onLogout={signOut} />
      </div>
    </div>
  );
}
const router = createBrowserRouter([{ path: '*', Component: OperationalRoute }]);
const queryClient = new QueryClient();
export default function App() { return <QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider>; }

function Screens({ onLogout }: { onLogout?: () => void }) {
  const [activeFilter, setActiveFilter] = useState<'all' | 'bob' | 'user'>('all');
  const navigate = useNavigate();
  const location = useLocation();
  const view = location.pathname.slice(1) || 'dashboard';
  const setView = (next: string) => navigate(next === 'dashboard' ? '/' : `/${next}`);
  const profile = useProfile();
  const [transactionSearch, setTransactionSearch] = useState('');
  const [siteSearch, setSiteSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState<'attention' | 'name' | 'output'>('attention');
  const { simTime, categories: portfolioCategories, stats: portfolioStats, sites: registeredSites, transactions: transactionRows } = usePortfolio();

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

  const visibleTransactions = transactionRows.filter(row => (activeFilter === 'all' || (activeFilter === 'bob') === row.initIsBot) && `${row.id} ${row.type} ${row.initiator}`.toLowerCase().includes(transactionSearch.toLowerCase()));
  const query = new URLSearchParams(location.search);
  const configId = Number(query.get('config'));
  const configSite = query.get('site') ?? SITE.id;
  const journey = (next: string) => navigate(`/${next}?config=${configId}&site=${configSite}`);

  if (view === 'askBob') return <AskBob />;
  if (['protected', 'workOrder', 'actionDetails', 'transaction'].includes(view)) return <OperationalPanels page={view} />;


  if (view === 'approval') return <ApprovalReview onBack={() => setView('monitoring')} />;

  if (view === 'monitoring') return <ActiveMonitoring onBack={() => setView('siteDetail')} onApprovalReview={() => setView('approval')} />;

  if (view === 'activate') return <ActivateConfig id={configId} site={configSite} onDone={() => setView('monitoring')} onClose={() => setView('bob')} />;
  if (view === 'test') return <TestConfig id={configId} site={configSite} onEdit={(c) => navigate(`/agentChat?asset=${c.asset}&kind=${c.kind}`)} onActivate={() => journey('activate')} onClose={() => setView('bob')} />;
  if (view === 'review') return <ReviewConfig id={configId} site={configSite} onEdit={(c) => navigate(`/agentChat?asset=${c.asset}&kind=${c.kind}`)} onTest={() => journey('test')} onClose={() => setView('bob')} />;

  if (view === 'agentChat' || view === 'bobSetup' || view === 'bob/setup') {
    return <AgentChat onClose={() => setView('bob')} onComplete={(id) => navigate(`/review?config=${id}&site=${SITE.id}`)} />;
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
    return <LiveOverview onBack={() => setView('siteDetail')} onBob={() => setView('bob')} onConnectData={() => setView('connectData')} onTabChange={(tab) => setView(tab === 'Live overview' ? 'liveOverview' : 'siteDetail')} />;
  }

  if (view === 'siteDetail' || view === 'aiActions' || view === 'recommendation' || view === 'audit') {
    return <SiteDetail key={view} onBack={() => setView('dashboard')} onLiveOverview={() => setView('liveOverview')} onBob={() => setView('bob')} onConnectData={() => setView('connectData')} />;
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
              <p className="font-mono font-medium text-[#525252] text-[13px] leading-normal">{simTime}</p>
            </div>
            <div
              className="bg-[#fdecef] border border-[#e82127] flex items-center justify-center rounded-full size-10 shrink-0 max-sm:flex-wrap cursor-pointer hover:opacity-90 transition-opacity"
              onClick={onLogout ? onLogout : () => setView('login')}
              title={profile ? `Signed in as ${profile.email} (click to sign out)` : 'Click to sign out'}
            >
              <p className="font-['IBM Plex Sans:Bold'] font-bold text-[#e82127] text-[14px] leading-normal" style={{ fontVariationSettings: '"wdth" 100' }}>{profile?.initials}</p>
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
                  <p className="font-['IBM Plex Sans:Medium'] font-medium text-[#8d8d8d] text-[11px] uppercase leading-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Live Output</p>
                  <p className="font-mono font-semibold text-[#198038] text-[20px] leading-normal whitespace-nowrap max-sm:whitespace-normal">{card.live}</p>
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
          <TopRecommendations onReview={() => setView('aiRec')} onAsk={() => setView('askBob')} />
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
            <div className="bg-[#f4f4f4] border-b border-[#e0e0e0] grid grid-cols-[minmax(0,1.7fr)_repeat(4,minmax(0,1fr))_repeat(2,minmax(0,1.2fr))_minmax(0,0.7fr)] gap-x-4 min-w-[880px] items-center [&>div]:min-w-0 px-6 py-3">
              <div className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#666] text-[11px] uppercase leading-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Site</div>
              <div className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#666] text-[11px] uppercase leading-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Live Output</div>
              <div className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#666] text-[11px] uppercase leading-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Performance</div>
              <div className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#666] text-[11px] uppercase leading-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Storage</div>
              <div className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#666] text-[11px] uppercase leading-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Grid Position</div>
              <div className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#666] text-[11px] uppercase leading-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Status</div>
              <div className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#666] text-[11px] uppercase leading-normal" style={{ fontVariationSettings: '"wdth" 100' }}>AI Activity</div>
              <div className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#666] text-[11px] uppercase leading-normal tracking-[0.5px]" style={{ fontVariationSettings: '"wdth" 100' }}>Action</div>
            </div>

            {/* Table Body */}
            <div className="flex flex-col">
              {filteredSites.map((site) => {
                const liveOutput = site.liveOutputMw;
                const livePercent = site.capacityMw ? Math.round((liveOutput / site.capacityMw) * 100) : 0;
                const batterySoc = site.storage.soc === null ? null : Math.round(site.storage.soc);
                const batteryStatusText = site.storage.statusText;
                const gridStatus = site.grid.status;
                const gridLoadText = site.grid.loadText;
                const statusObj = site.status;
                const badgeStyle = getStatusBadge(statusObj);

                return (
                  <div
                    key={site.id}
                    className={`bg-white border-b border-[#e0e0e0] grid grid-cols-[minmax(0,1.7fr)_repeat(4,minmax(0,1fr))_repeat(2,minmax(0,1.2fr))_minmax(0,0.7fr)] gap-x-4 min-w-[880px] items-center [&>div]:min-w-0 px-6 py-4`}
                  >
                    {/* Site */}
                    <div className="flex gap-3 items-center max-sm:flex-wrap">
                      <div className="bg-[#f4f4f4] p-2 rounded-[2px] shrink-0">
                        <div className="size-[18px] relative">
                          <img alt="" className="absolute inset-0 size-full" src={getSiteIcon(site.type)} />
                        </div>
                      </div>
                      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                        <div className="flex gap-2 items-center max-sm:flex-wrap">
                          <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#1a1a1a] text-[14px] leading-normal truncate" title={site.name} style={{ fontVariationSettings: '"wdth" 100' }}>{site.name}</p>
                          {site.isLive && (
                            <div className="flex gap-1 items-center shrink-0 max-sm:flex-wrap">
                              <div className="size-1.5 relative"><img alt="" className="absolute inset-0 size-full" src={imgLiveDot} /></div>
                              <p className="font-['IBM Plex Sans:Medium'] font-medium text-[#198038] text-[11px] leading-normal break-words" style={{ fontVariationSettings: '"wdth" 100' }}>Live</p>
                            </div>
                          )}
                        </div>
                        <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#525252] text-[12px] leading-normal break-words" style={{ fontVariationSettings: '"wdth" 100' }}>
                          {site.location} · {site.type}
                        </p>
                      </div>
                    </div>

                    {/* Live Output */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex gap-1 items-baseline max-sm:flex-wrap">
                        <p className="font-mono font-bold text-[#161616] text-[14px] leading-normal">{mw(liveOutput)}</p>
                        <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#525252] text-[11px] leading-normal" style={{ fontVariationSettings: '"wdth" 100' }}>active</p>
                      </div>
                      <div className="bg-[#f4f4f4] h-1 rounded-[2px] overflow-hidden w-20">
                        <div className="bg-[#198038] h-full" style={{ width: `${Math.min(100, livePercent)}%` }} />
                      </div>
                      <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#525252] text-[11px] leading-normal break-words" style={{ fontVariationSettings: '"wdth" 100' }}>of <span className="font-mono">{site.capacityMw} MW</span> capacity</p>
                    </div>

                    {/* Performance */}
                    <div className="flex flex-col gap-0.5">
                      {site.performance ? (
                        <>
                          <p
                            className="font-mono font-semibold text-[14px] leading-normal break-words"
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
                              className="font-['IBM Plex Sans:Regular'] font-normal text-[12px] leading-normal break-words"
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
                        <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#525252] text-[13px] leading-normal break-words" style={{ fontVariationSettings: '"wdth" 100' }}>Unavailable</p>
                      )}
                    </div>

                    {/* Storage */}
                    <div className="flex flex-col gap-0.5">
                      {batterySoc !== null ? (
                        <>
                          <div className="flex gap-1.5 items-center max-sm:flex-wrap">
                            <div className="size-3.5 relative">
                              <img alt="" className="absolute inset-0 size-full" src={batterySoc < 30 ? imgBatteryLow : imgBattery1} />
                            </div>
                            <p className="font-mono font-semibold text-[#161616] text-[14px] leading-normal">{batterySoc}%</p>
                          </div>
                          <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#525252] text-[12px] leading-normal break-words" style={{ fontVariationSettings: '"wdth" 100' }}>{batteryStatusText}</p>
                        </>
                      ) : (
                        <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#525252] text-[13px] leading-normal break-words" style={{ fontVariationSettings: '"wdth" 100' }}>{batteryStatusText || 'No battery'}</p>
                      )}
                    </div>

                    {/* Grid Position */}
                    <div className="flex flex-col gap-0.5">
                      <div className="flex gap-1.5 items-center max-sm:flex-wrap">
                        <div className="size-3.5 relative">
                          <img alt="" className="absolute inset-0 size-full" src={getGridIcon(gridStatus)} />
                        </div>
                        <p className="font-['IBM Plex Sans:Medium'] font-medium text-[#161616] text-[13px] leading-normal break-words" style={{ fontVariationSettings: '"wdth" 100' }}>{gridStatus}</p>
                      </div>
                      <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#525252] text-[12px] leading-normal break-words" style={{ fontVariationSettings: '"wdth" 100' }}>{gridLoadText}</p>
                    </div>

                    {/* Status */}
                    <div>
                      <div className={`${badgeStyle.bg} flex flex-wrap gap-1.5 min-h-6 items-center px-2 py-1 rounded-[2px] w-fit max-w-full`}>
                        <div className="size-1.5 relative">
                          <img alt="" className="absolute inset-0 size-full" src={badgeStyle.dot} />
                        </div>
                        <p className={`font-['IBM Plex Sans:Medium'] font-medium ${badgeStyle.text} text-[12px] leading-normal break-words`} style={{ fontVariationSettings: '"wdth" 100' }}>{statusObj.label}</p>
                        {statusObj.badgeCount && (
                          <div className={`${badgeStyle.badgeBg} flex items-center justify-center rounded-full size-3.5 max-sm:flex-wrap`}>
                            <p className="font-['IBM Plex Sans:Bold'] font-bold text-white text-[9px] leading-normal" style={{ fontVariationSettings: '"wdth" 100' }}>{statusObj.badgeCount}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* AI Activity */}
                    <div className="flex gap-2 items-center max-sm:flex-wrap">
                      <div className="size-3.5 relative">
                        <img alt="" className="absolute inset-0 size-full" src={imgSparkles1} />
                      </div>
                      <div className="flex gap-1.5 items-center max-sm:flex-wrap">
                        <p
                          className={`font-['IBM Plex Sans:Medium'] font-medium ${site.aiActivity.isPulsing ? 'text-[#0f62fe]' : 'text-[#525252]'} text-[13px] leading-normal break-words`}
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
                    <div className="flex items-center">
                      <p
                        className="font-['IBM Plex Sans:Medium'] font-medium text-[#0f62fe] text-[13px] leading-normal cursor-pointer break-words hover:text-[#0043ce] hover:underline"
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
                    <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#525252] leading-normal" style={{ fontVariationSettings: '"wdth" 100' }}>{stat.note}</p>
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
                <p className="font-['IBM Plex Sans:Medium'] font-medium text-[#525252] text-[14px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>All sites</p>
              </div>
              <div className="bg-white border-b border-[#e0e0e0] flex gap-2 items-center px-3.5 py-2.5 max-sm:flex-wrap">
                <div className="size-3.5 relative shrink-0"><img alt="" className="absolute inset-0 size-full" src={imgCalendar} /></div>
                <p className="font-['IBM Plex Sans:Medium'] font-medium text-[#525252] text-[14px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}><span className="font-mono">{simTime.split(',')[0]}</span> · IST</p>
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
                { label: 'Tier', w: 'w-[130px]' },
                { label: 'Status', w: 'w-[120px]' },
              ].map(col => (
                <p key={col.label} className={`font-['IBM Plex Sans:SemiBold'] font-semibold text-[#161616] text-[12px] tracking-[0.32px] uppercase leading-normal ${col.w} shrink-0`} style={{ fontVariationSettings: '"wdth" 100' }}>{col.label}</p>
              ))}
              <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#161616] text-[12px] tracking-[0.32px] uppercase leading-normal flex-1 text-right max-sm:flex-wrap" style={{ fontVariationSettings: '"wdth" 100' }}>Action</p>
            </div>

            {/* Table Rows */}
            {visibleTransactions.map((row, i) => (
              <div key={row.id} className={`bg-white border-b border-[#e0e0e0] grid grid-cols-[140px_minmax(180px,1.4fr)_160px_180px_130px_130px_120px_80px] min-w-[1280px] gap-4 [&>div]:w-auto [&>p]:w-auto items-center px-6 py-4`}>
                <div className="w-[140px] shrink-0">
                  <p className="font-mono font-medium text-[#161616] text-[13px] leading-normal whitespace-nowrap max-sm:whitespace-normal">{row.date}</p>
                </div>
                <div className="w-[220px] shrink-0">
                  <p className="font-['IBM Plex Sans:Medium'] font-medium text-[#161616] text-[14px] leading-normal overflow-hidden text-ellipsis whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>{row.site}</p>
                </div>
                <div className="w-[160px] shrink-0 flex gap-2 items-center max-sm:flex-wrap">
                  <div className="size-3.5 relative shrink-0"><img alt="" className="absolute inset-0 size-full" src={row.typeIcon} /></div>
                  <p className="font-['IBM Plex Sans:Medium'] font-medium text-[#161616] text-[14px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>{row.type}</p>
                </div>
                <div className="w-[180px] shrink-0 flex gap-2 items-center max-sm:flex-wrap">
                  {row.initIsBot ? (
                    <div className="p-1 shrink-0 bg-[#defbe6]">
                      <div className="size-3.5 relative"><img alt="" className="absolute inset-0 size-full" src={imgCpu3} /></div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center size-[22px] shrink-0 max-sm:flex-wrap bg-[#e0f2fe]">
                      <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#161616] text-[10px] leading-normal" style={{ fontVariationSettings: '"wdth" 100' }}>{row.initInitials}</p>
                    </div>
                  )}
                  <p className="font-['IBM Plex Sans:Medium'] font-medium text-[14px] leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>{row.initiator}</p>
                </div>
                <div className="w-[130px] shrink-0">
                  <p className="font-mono font-semibold text-[#161616] text-[14px] leading-normal whitespace-nowrap max-sm:whitespace-normal">{row.amount}</p>
                </div>
                <div className="w-[130px] shrink-0">
                  <p className="font-['IBM Plex Sans:Medium'] font-medium text-[#525252] text-[14px] leading-normal whitespace-nowrap max-sm:whitespace-normal">{row.tier}</p>
                </div>
                <div className="w-[120px] shrink-0">
                  <div className={`flex items-start px-2.5 py-1 w-fit rounded-[2px] max-sm:flex-wrap ${TONE_TAG[row.statusTone]}`}>
                    <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[12px] uppercase leading-normal whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>{row.status}</p>
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
