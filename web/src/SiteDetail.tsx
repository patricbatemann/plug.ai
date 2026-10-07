import { useState } from 'react';
import BobToggle from './BobToggle';
import { SITE, SNAPSHOT_14_32, BATTERY_POLICY } from './data';
import { useOperations } from './Operations';
import { Link } from 'react-router';
import { getSiteAssets, getMonitoringFeeds } from './services/siteService';

const assetPathPrefix = '/assets';
const imgRectangle = `${assetPathPrefix}/04a31.png`;
const imgIconSun = `${assetPathPrefix}/31b52.svg`;
const imgIconBot = `${assetPathPrefix}/8be4b.svg`;
const imgMoreHorizontal = `${assetPathPrefix}/05748.svg`;
const imgEllipse = `${assetPathPrefix}/71d6b.svg`;
const imgMapPin = `${assetPathPrefix}/73303.svg`;
const imgPlus = `${assetPathPrefix}/2475a.svg`;
const imgInfo = `${assetPathPrefix}/5aea5.svg`;
const imgCheck = `${assetPathPrefix}/62953.svg`;
const imgCheck1 = `${assetPathPrefix}/49981.svg`;
const imgCheck2 = `${assetPathPrefix}/18999.svg`;
const imgInfo1 = `${assetPathPrefix}/d33bd.svg`;

interface SiteDetailProps {
  initialTab?: TabId;
  onTabChange?: (tab: TabId) => void;
  onBack: () => void;
  onLiveOverview?: () => void;
  onBob?: () => void;
  onConnectData?: () => void;
}

type TabId = 'site' | 'live';

function ibm(w: 'Regular' | 'Medium' | 'SemiBold' | 'Bold', extra = '') {
  const wt = { Regular: 'normal', Medium: 'medium', SemiBold: 'semibold', Bold: 'bold' }[w];
  return { className: `font-['IBM Plex Sans:${w}'] font-${wt} ${extra}`, style: { fontVariationSettings: '"wdth" 100' } };
}

function Tag({ text, color }: { text: string; color: 'green' | 'gray' | 'purple' | 'orange' | 'blue' }) {
  const styles = {
    green: { bg: '#defbe6', text: '#198038', border: '#a7f0ba' },
    gray: { bg: '#f4f4f4', text: '#525252', border: '#e0e0e0' },
    purple: { bg: '#f4f0ff', text: '#8a3ffc', border: '#d4bbff' },
    orange: { bg: '#fef3c7', text: '#b26207', border: '#fde68a' },
    blue: { bg: '#edf5ff', text: '#0f62fe', border: '#a6c8ff' },
  }[color];
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-[2px] border shrink-0 max-sm:flex-wrap" style={{ backgroundColor: styles.bg, borderColor: styles.border }}>
      <p {...ibm('SemiBold', 'text-[12px] whitespace-nowrap max-sm:whitespace-normal')} style={{ color: styles.text, fontVariationSettings: '"wdth" 100' }}>{text}</p>
    </div>
  );
}

function DetailRow({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={`flex flex-col sm:flex-row gap-2 sm:gap-4 items-start pb-3 ${last ? '' : 'border-b border-[#e0e0e0]'}`}>
      <p {...ibm('SemiBold', 'text-[#161616] text-[14px] leading-normal w-full sm:w-[200px] shrink-0')}>{label}</p>
      <div className="flex flex-1 items-start min-w-0 sm:justify-end max-sm:flex-wrap">{children}</div>
    </div>
  );
}

function DetailText({ value, mono = false }: { value: string; mono?: boolean }) {
  if (mono) {
    return <p className="font-mono text-[#525252] text-[14px] leading-normal text-right">{value}</p>;
  }
  return <p {...ibm('Regular', 'text-[#525252] text-[14px] leading-normal text-right')}>{value}</p>;
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#e0e0e0] flex flex-col gap-4 p-6 rounded-[2px] w-full">
      {children}
    </div>
  );
}

function InlineNotification({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="bg-[#edf5ff] border border-[#a6c8ff] relative flex gap-3 items-center px-4 py-3 rounded-[2px] w-full max-sm:flex-wrap">
      <div className="absolute bg-[#0f62fe] bottom-0 left-0 top-0 w-[3px] rounded-l-[2px]" />
      <img alt="" className="size-4 shrink-0" src={icon} />
      <p {...ibm('Regular', 'text-[#161616] text-[14px] leading-[1.4] flex-1')}>{text}</p>
    </div>
  );
}

const ASSETS = getSiteAssets().map(asset => ({
  name: asset.name,
  type: asset.type,
  capacity: asset.capacity,
  status: { label: asset.status, color: '#e5f6ee', text: '#0e6027' },
  monitoring: asset.monitoring,
  remote: asset.remote,
  bob: asset.bobPermission,
  bobLink: asset.bobActionLink,
}));

const MONITORING_FEEDS = getMonitoringFeeds().map(feed => feed.name);


const TABS: { id: TabId; label: string }[] = [
  { id: 'site', label: 'Site Details' },
  { id: 'live', label: 'Live Overview' },
];

export default function SiteDetail({ onBack, onLiveOverview, onBob, onConnectData, initialTab = 'site', onTabChange }: SiteDetailProps) {
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const { state, flow } = useOperations();
  const assets = ASSETS.map(asset => asset.name === "Grid Connection" ? { ...asset, remote: state.gridRemoteAvailable ? "Available ✓" : "Not available —", bob: state.gridControlGranted ? "Granted & verified" : null, bobLink: state.gridControlGranted ? "Review permission" : undefined } : asset);

  const handleTabClick = (tab: TabId) => {
    if (tab === 'live' && onLiveOverview) { onLiveOverview(); return; }
    if (onTabChange) { onTabChange(tab); return; }
    setActiveTab(tab);
  };

  return (
    <div className="bg-[#f4f4f4] min-h-screen w-full flex flex-col">

      {/* Global nav bar */}
      <div className="bg-white border-b border-[#e0e0e0] flex min-h-12 flex-wrap gap-4 items-center justify-between px-4 md:px-6 py-2 shrink-0">
        <div className="flex gap-6 items-center max-sm:flex-wrap">
          <div className="flex gap-2 items-center max-sm:flex-wrap">
            <div className="relative size-6 shrink-0">
              <img alt="" className="absolute inset-0 size-full" src={imgEllipse} />
            </div>
            <p {...ibm('SemiBold', 'text-[#161616] text-[16px]')}>Kuppam Solar</p>
          </div>
          <nav className="flex gap-6 items-center max-sm:flex-wrap">
            <div className="flex flex-col gap-1 items-center">
              <p {...ibm('SemiBold', 'text-[#0f62fe] text-[13px]')}>Site</p>
              <div className="bg-[#0f62fe] h-0.5 w-6" />
            </div>
            <button onClick={onBob} className="cursor-pointer">
              <p {...ibm('Medium', 'text-[#525252] text-[13px] hover:text-[#161616] transition-colors')}>BOB</p>
            </button>
            <p {...ibm('Medium', 'text-[#525252] text-[13px]')}>Settings</p>
          </nav>
        </div>
      </div>

      {/* Site page header */}
      <div className="bg-white border-b border-[#e0e0e0] flex flex-col gap-3 px-6 py-4 shrink-0">
        {/* Breadcrumbs */}
        <div className="flex gap-2 items-center max-sm:flex-wrap">
          {[
            { text: 'Sites', clickable: true, onClick: onBack },
            { text: '/', clickable: false },
            { text: 'Kuppam Solar Site', clickable: false },
            { text: '/', clickable: false },
            { text: 'Site Details', clickable: false },
          ].map((b, i) => (
            <p key={i} onClick={b.onClick}
              {...ibm('Regular', `text-[13px] ${b.clickable ? 'text-[#525252] cursor-pointer hover:text-[#0f62fe] transition-colors' : b.text === '/' ? 'text-[#8d8d8d]' : 'text-[#525252]'}`)}
            >{b.text}</p>
          ))}
        </div>

        {/* Title row */}
        <div className="flex flex-col md:flex-row items-start justify-between gap-4">
          <div className="flex flex-col gap-2 flex-1 min-w-0">
            <div className="flex gap-3 items-center max-sm:flex-wrap">
              <div className="bg-[#fef8ed] flex items-center justify-center rounded-[2px] size-8 shrink-0 max-sm:flex-wrap">
                <img alt="" className="size-6" src={imgIconSun} />
              </div>
              <p {...ibm('Bold', 'text-[#161616] text-[24px] leading-normal')}>
                Kuppam Solar Site · <span className="font-mono text-[#525252] font-semibold">{SITE.id}</span>
              </p>
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              <Tag text="Operational" color="green" />
              <Tag text="Solar PV" color="gray" />
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-[2px] border border-[#e0e0e0] bg-[#f4f4f4] shrink-0 max-sm:flex-wrap">
                <p className="font-mono font-medium text-[#525252] text-[12px] whitespace-nowrap max-sm:whitespace-normal">
                  {SITE.capacity} MW · {flow.soc}% SOC
                </p>
              </div>
            </div>
            <p {...ibm('Regular', 'text-[#525252] text-[14px] leading-normal')}>
              Andhra Pradesh, India · Commissioned 2021 · Snapshot <span className="font-mono text-[#161616]">{SNAPSHOT_14_32.timestamp}</span>
            </p>
          </div>

          <div className="flex gap-3 items-center shrink-0 max-sm:flex-wrap">
            <div className="bg-[#f4f0ff] border border-[#d4bbff] flex gap-1.5 items-center px-2 py-1 rounded-[2px] max-sm:flex-wrap">
              <img alt="" className="size-4" src={imgIconBot} />
              <p {...ibm('SemiBold', 'text-[#8a3ffc] text-[12px]')}>{state.activated ? (state.stage === 'Executing' ? 'BOB Executing' : 'BOB Active') : `BOB ${state.stage}`}</p>
            </div>
            <Tag text="Data: Preview" color="green" />
            <Tag text="Mode: Balanced" color="gray" />
            <BobToggle />
            <button onClick={onBob}
              className="bg-[#0f62fe] flex items-center px-4 py-2 rounded-[2px] hover:bg-[#0043ce] transition-colors cursor-pointer max-sm:flex-wrap">
              <p {...ibm('SemiBold', 'text-white text-[13px]')}>Configure AI Actions</p>
            </button>
            <button className="bg-white border border-[#e0e0e0] flex items-center justify-center p-2 rounded-[2px] hover:bg-[#f4f4f4] transition-colors cursor-pointer max-sm:flex-wrap">
              <img alt="" className="size-4" src={imgMoreHorizontal} />
            </button>
          </div>
        </div>

        {/* Freshness */}
        <p {...ibm('Regular', 'text-[#525252] text-[13px]')}>
          Snapshot <span className="font-mono text-[#161616]">{flow.timestamp}</span> · Preview source ages: site sensors <span className="font-mono">12s</span>, weather <span className="font-mono">24s</span>, battery <span className="font-mono">8s</span>, grid <span className="font-mono">15s</span> (not live telemetry)
        </p>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-[#e0e0e0] flex gap-8 items-center h-12 overflow-x-auto px-4 md:px-6 shrink-0">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => handleTabClick(tab.id)} aria-current={activeTab === tab.id ? 'page' : undefined} className="flex min-h-11 shrink-0 flex-col justify-center gap-1 items-center cursor-pointer">
            <p {...ibm(activeTab === tab.id ? 'SemiBold' : 'Medium', `text-[13px] ${activeTab === tab.id ? 'text-[#0f62fe]' : 'text-[#525252] hover:text-[#161616]'} transition-colors whitespace-nowrap max-sm:whitespace-normal`)}>
              {tab.label}
            </p>
            <div className={`h-0.5 w-full transition-colors ${activeTab === tab.id ? 'bg-[#0f62fe]' : 'bg-transparent'}`} />
          </button>
        ))}
      </div>

      {/* Main body */}
      <div className="flex flex-col gap-8 items-start px-4 md:px-8 py-6 pb-12 w-full">

        {/* Site details */}
        <SectionCard>
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <p {...ibm('SemiBold', 'text-[#161616] text-[20px]')}>Site details</p>
            <button className="border border-[#e0e0e0] flex items-center px-4 py-2.5 rounded-[2px] hover:bg-[#f4f4f4] transition-colors cursor-pointer max-sm:flex-wrap">
              <p {...ibm('Medium', 'text-[#0f62fe] text-[14px]')}>Edit</p>
            </button>
          </div>
          <div className="flex flex-col gap-3">
            <DetailRow label="Site name"><DetailText value="Kuppam Solar Site" /></DetailRow>
            <DetailRow label="Site ID"><DetailText value={SITE.id} mono={true} /></DetailRow>
            <DetailRow label="Site type"><DetailText value="Solar site" /></DetailRow>
            <DetailRow label="Capacity">
              <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#525252] text-[14px] leading-normal text-right">
                <span className="font-mono font-medium text-[#161616]">{SITE.capacity} MW</span> · 5 connected assets (<span className="font-mono font-medium text-[#161616]">{state.gridRemoteAvailable ? 2 : 1}</span> remote-controllable)
              </p>
            </DetailRow>
            <DetailRow label="Status">
              <div className="bg-[#defbe6] border border-[#a7f0ba] flex items-center px-2 py-0.5 rounded-[2px] max-sm:flex-wrap">
                <p {...ibm('SemiBold', 'text-[#198038] text-[12px]')}>Operational</p>
              </div>
            </DetailRow>
            <DetailRow label="Commissioning date"><DetailText value="15 June 2021" /></DetailRow>
            <DetailRow label="Owner"><DetailText value="Kuppam Solar Site Operations" /></DetailRow>
            <DetailRow label="Operator"><DetailText value="Kuppam Operations Team" /></DetailRow>
            <DetailRow label="Time zone"><DetailText value="India Standard Time (UTC+5:30)" /></DetailRow>
            <DetailRow label="Description" last>
              <DetailText value="Utility-scale solar photovoltaic installation serving local demand with battery storage support." />
            </DetailRow>
          </div>
        </SectionCard>

        {/* Primary contact */}
        <SectionCard>
          <p {...ibm('SemiBold', 'text-[#161616] text-[20px]')}>Primary contact</p>
          <div className="flex flex-col gap-3">
            <DetailRow label="Name / role"><DetailText value="Bharath Kumar (Site Manager)" /></DetailRow>
            <DetailRow label="Email">
              <a href="mailto:bharath.kumar@example.com" className="text-[#0f62fe] text-[14px] font-['IBM Plex Sans:Regular'] font-normal hover:underline" style={{ fontVariationSettings: '"wdth" 100' }}>
                bharath.kumar@example.com
              </a>
            </DetailRow>
            <DetailRow label="Phone" last><DetailText value="+91 98765 43210" mono={true} /></DetailRow>
          </div>
        </SectionCard>

        {/* Location */}
        <SectionCard>
          <p {...ibm('SemiBold', 'text-[#161616] text-[20px]')}>Location</p>
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-8 items-start">
            {/* Left: details */}
            <div className="flex flex-1 flex-col gap-4 min-w-0">
              <div className="flex flex-col gap-1">
                <p {...ibm('SemiBold', 'text-[#161616] text-[14px]')}>Address</p>
                <p {...ibm('Regular', 'text-[#525252] text-[14px] leading-normal')}>Kuppam, Chittoor District, Andhra Pradesh, India</p>
              </div>
              <div className="flex gap-6 items-start max-sm:flex-wrap">
                {[
                  { label: 'Latitude', value: '12.7480°N' },
                  { label: 'Longitude', value: '78.3410°E' },
                  { label: 'Elevation', value: '680m' },
                ].map(c => (
                  <div key={c.label} className="flex flex-col gap-1">
                    <p {...ibm('SemiBold', 'text-[#161616] text-[14px]')}>{c.label}</p>
                    <p className="font-mono text-[#525252] text-[14px] leading-normal">{c.value}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-1">
                <p {...ibm('SemiBold', 'text-[#161616] text-[14px]')}>Grid region</p>
                <p {...ibm('Regular', 'text-[#525252] text-[14px]')}>Andhra Pradesh DISCOM</p>
              </div>
              <div className="flex gap-3 items-start max-sm:flex-wrap">
                <div className="flex flex-col gap-1">
                  <p {...ibm('Regular', 'text-[#525252] text-[11px] uppercase tracking-wide')}>Weather coverage</p>
                  <div className="bg-[#defbe6] border border-[#a7f0ba] flex items-center px-2 py-0.5 rounded-[2px] max-sm:flex-wrap">
                    <p {...ibm('SemiBold', 'text-[#198038] text-[12px]')}>Available</p>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <p {...ibm('Regular', 'text-[#525252] text-[11px] uppercase tracking-wide')}>Solar forecast</p>
                  <div className="bg-[#defbe6] border border-[#a7f0ba] flex items-center px-2 py-0.5 rounded-[2px] max-sm:flex-wrap">
                    <p {...ibm('SemiBold', 'text-[#198038] text-[12px]')}>Available</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: map */}
            <div className="flex flex-col gap-3 shrink-0 w-full min-w-0">
              <div className="border border-[#e0e0e0] flex flex-col h-[200px] items-center justify-center relative rounded-[2px] overflow-hidden">
                <img alt="Kuppam Solar Site map" className="absolute inset-0 object-cover size-full pointer-events-none" src={imgRectangle} />
                <div className="absolute inset-0 bg-black/8" />
                <div className="bg-white border-2 border-[#0f62fe] relative flex gap-2 items-center p-2 rounded-[2px] z-10 max-sm:flex-wrap">
                  <img alt="" className="size-4" src={imgMapPin} />
                  <p className="font-mono font-semibold text-[#161616] text-[12px]">12.7480°N, 78.3410°E</p>
                </div>
              </div>
              <a href="https://maps.google.com/?q=12.7480,78.3410" target="_blank" rel="noopener noreferrer"
                {...ibm('SemiBold', 'text-[#0f62fe] text-[14px] underline cursor-pointer hover:text-[#0043ce] transition-colors')}>
                View full map
              </a>
            </div>
          </div>
        </SectionCard>

        {/* Assets */}
        <SectionCard>
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex gap-3 items-center max-sm:flex-wrap">
              <p {...ibm('SemiBold', 'text-[#161616] text-[20px]')}>Assets</p>
              <div className="bg-[#f4f4f4] border border-[#e0e0e0] flex items-center px-2 py-0.5 rounded-[2px] max-sm:flex-wrap">
                <p {...ibm('SemiBold', 'text-[#161616] text-[11px]')}>5 assets · 3 control systems</p>
              </div>
            </div>
            <button type="button" onClick={onConnectData} className="bg-[#0f62fe] flex gap-2 items-center min-h-11 px-4 py-2.5 rounded-[2px] hover:bg-[#0043ce] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f62fe] transition-colors cursor-pointer max-sm:flex-wrap">
              <img alt="" className="size-4" src={imgPlus} />
              <p {...ibm('Medium', 'text-white text-[14px]')}>Add asset</p>
            </button>
          </div>

          {/* Table */}
          <div className="flex flex-col w-full overflow-x-auto focus-visible:outline-2 focus-visible:outline-[#0f62fe]" role="region" aria-label="Site assets table" tabIndex={0} data-table="assets">
            {/* Header */}
            <div className="bg-[#f4f4f4] border-b border-[#e0e0e0] grid grid-cols-[180px_170px_150px_130px_120px_150px_minmax(280px,1fr)] gap-4 min-w-[1308px] items-center [&>p]:w-auto [&>div]:w-auto px-4 py-3">
              {[
                { label: 'Asset name', w: 'w-[220px]' },
                { label: 'Type', w: 'w-[180px]' },
                { label: 'Capacity', w: 'w-[160px]' },
                { label: 'Status', w: 'w-[140px]' },
                { label: 'Monitoring', w: 'w-[120px]' },
                { label: 'Remote control', w: 'w-[140px]' },
                { label: 'BOB permission', w: 'flex-1 min-w-0' },
              ].map(col => (
                <p key={col.label} {...ibm('SemiBold', `text-[#161616] text-[14px] ${col.w} shrink-0`)}>{col.label}</p>
              ))}
            </div>

            {/* Rows */}
            {assets.map((asset, i) => (
              <div key={asset.name} className={`grid grid-cols-[180px_170px_150px_130px_120px_150px_minmax(280px,1fr)] gap-4 min-w-[1308px] items-center [&>p]:w-auto [&>div]:w-auto px-4 py-3.5 ${i < assets.length - 1 ? 'border-b border-[#e0e0e0]' : ''}`}>
                <p {...ibm('Medium', 'text-[#161616] text-[14px] w-[220px] shrink-0')}>{asset.name}</p>
                <p {...ibm('Regular', 'text-[#525252] text-[14px] w-[180px] shrink-0')}>{asset.type}</p>
                <p className="font-mono text-[#525252] text-[14px] w-[160px] shrink-0">{asset.capacity}</p>
                <div className="w-[140px] shrink-0">
                  <div className="flex items-center px-2 py-0.5 rounded-[2px] self-start border border-[#a7f0ba] max-sm:flex-wrap" style={{ backgroundColor: '#defbe6' }}>
                    <p {...ibm('SemiBold', 'text-[12px] whitespace-nowrap max-sm:whitespace-normal text-[#198038]')}>{asset.status.label}</p>
                  </div>
                </div>
                <p {...ibm('Regular', 'text-[#525252] text-[14px] w-[120px] shrink-0')}>{asset.monitoring}</p>
                <p {...ibm('Regular', 'text-[#525252] text-[14px] w-[140px] shrink-0')}>{asset.remote}</p>
                <div className="flex flex-1 items-center gap-3 min-w-0 max-sm:flex-wrap">
                  {asset.bob ? (
                    <>
                      <div className="bg-[#defbe6] border border-[#a7f0ba] flex items-center px-2 py-0.5 rounded-[2px] max-sm:flex-wrap">
                        <p {...ibm('SemiBold', 'text-[#198038] text-[12px] whitespace-nowrap max-sm:whitespace-normal')}>{asset.bob}</p>
                      </div>
                      {asset.bobLink && (
                        <button onClick={onBob} className="cursor-pointer">
                          <p {...ibm('SemiBold', 'text-[#0f62fe] text-[13px] underline whitespace-nowrap max-sm:whitespace-normal hover:text-[#0043ce] transition-colors')}>{asset.bobLink}</p>
                        </button>
                      )}
                    </>
                  ) : (
                    <p {...ibm('Regular', 'text-[#525252] text-[14px]')}>Not applicable —</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Data access and permissions */}
        <SectionCard>
          <p {...ibm('SemiBold', 'text-[#161616] text-[20px]')}>Data access and permissions</p>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* Col 1: Monitoring data */}
            <div className="flex flex-1 flex-col gap-4 min-w-0">
              <p {...ibm('SemiBold', 'text-[#161616] text-[16px]')}>Monitoring data</p>
              <div className="flex flex-col gap-2">
                {MONITORING_FEEDS.map(feed => (
                  <div key={feed} className="flex gap-2 items-center max-sm:flex-wrap">
                    <img alt="" className="size-3.5 shrink-0" src={imgCheck2} />
                    <p {...ibm('Regular', 'text-[#525252] text-[14px]')}>{feed}</p>
                  </div>
                ))}
              </div>
              <p {...ibm('SemiBold', 'text-[#198038] text-[13px]')}>6 of 6 monitoring feeds available · {state.connections.length} additional read-only data sources</p>
            </div>

            {/* Col 2: Remote control */}
            <div className="flex flex-1 flex-col gap-4 min-w-0">
              <p {...ibm('SemiBold', 'text-[#161616] text-[16px]')}>Remote control</p>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <p {...ibm('Medium', 'text-[#161616] text-[14px]')}>Battery 1</p>
                  <div className="flex gap-2 items-center max-sm:flex-wrap">
                    <p {...ibm('Regular', 'text-[#525252] text-[13px]')}>Technically available,</p>
                    <div className="bg-[#defbe6] flex items-center px-2 py-1 rounded-[2px] max-sm:flex-wrap">
                      <p {...ibm('SemiBold', 'text-[#198038] text-[12px]')}>Permission granted</p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <p {...ibm('Medium', 'text-[#161616] text-[14px]')}>Solar array</p>
                  <p {...ibm('Regular', 'text-[#525252] text-[13px]')}>Not available</p>
                </div>
                <div className="flex flex-col gap-1">
                  <p {...ibm('Medium', 'text-[#161616] text-[14px]')}>Grid connection</p>
                  <p {...ibm('Regular', 'text-[#525252] text-[13px]')}>{state.gridRemoteAvailable ? "Available; permission configured separately" : "Not available"}</p>
                </div>
              </div>
              <p {...ibm('SemiBold', 'text-[#161616] text-[13px]')}>{state.gridRemoteAvailable ? 2 : 1} systems support remote control</p>
            </div>

            {/* Col 3: BOB control permissions */}
            <div className="flex flex-1 flex-col gap-4 min-w-0">
              <p {...ibm('SemiBold', 'text-[#161616] text-[16px]')}>BOB control permissions</p>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <p {...ibm('Medium', 'text-[#161616] text-[14px]')}>Battery 1</p>
                  <div className="flex gap-2 items-center max-sm:flex-wrap">
                    <div className="bg-[#defbe6] flex items-center px-2 py-1 rounded-[2px] max-sm:flex-wrap">
                      <p {...ibm('SemiBold', 'text-[#198038] text-[12px]')}>Granted & verified</p>
                    </div>
                    <button onClick={onBob} className="cursor-pointer">
                      <p {...ibm('SemiBold', 'text-[#0f62fe] text-[13px] underline hover:text-[#0043ce] transition-colors')}>Review setup</p>
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <p {...ibm('Medium', 'text-[#161616] text-[14px]')}>Grid & other assets</p>
                  <p {...ibm('Regular', 'text-[#525252] text-[13px]')}>{state.gridControlGranted ? "Grid connection: granted by administrator" : "Grid connection: not granted"}</p><button onClick={onBob} className="inline-flex min-h-11 items-center text-sm text-[#0f62fe] cursor-pointer hover:underline">Review control permissions</button>
                </div>
              </div>
            </div>
          </div>

          <InlineNotification
            icon={imgInfo1}
            text="Connecting a system does not automatically grant BOB control permission. Control permissions are configured separately in BOB Agent Setup."
          />
        </SectionCard>

      </div>
    </div>
  );
}
