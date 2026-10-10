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

export interface SiteDetailsData {
  name: string;
  id: string;
  type: string;
  capacityMW: number;
  status: 'Operational' | 'Maintenance' | 'Degraded' | 'Offline';
  commissionedDate: string;
  owner: string;
  operator: string;
  timeZone: string;
  description: string;
}

const DEFAULT_SITE_DETAILS: SiteDetailsData = {
  name: 'Kuppam Solar Site',
  id: SITE.id,
  type: 'Solar site',
  capacityMW: SITE.capacity,
  status: 'Operational',
  commissionedDate: '15 June 2021',
  owner: 'Kuppam Solar Site Operations',
  operator: 'Kuppam Operations Team',
  timeZone: 'India Standard Time (UTC+5:30)',
  description: 'Utility-scale solar photovoltaic installation serving local demand with battery storage support.',
};

export interface PrimaryContactData {
  nameRole: string;
  email: string;
  phone: string;
}

const DEFAULT_PRIMARY_CONTACT: PrimaryContactData = {
  nameRole: 'Bharath Kumar (Site Manager)',
  email: 'bharath.kumar@example.com',
  phone: '+91 98765 43210',
};

export interface SiteLocationData {
  address: string;
  latitude: string;
  longitude: string;
  elevation: string;
  gridRegion: string;
  weatherCoverage: string;
  solarForecast: string;
}

const DEFAULT_SITE_LOCATION: SiteLocationData = {
  address: 'Kuppam, Chittoor District, Andhra Pradesh, India',
  latitude: '12.7480°N',
  longitude: '78.3410°E',
  elevation: '680m',
  gridRegion: 'Andhra Pradesh DISCOM',
  weatherCoverage: 'Available',
  solarForecast: 'Available',
};

export type AssetItem = (typeof ASSETS)[number] & {
  remote: string;
  bob: string | null;
  bobLink?: string | null;
};

export default function SiteDetail({ onBack, onLiveOverview, onBob, onConnectData, initialTab = 'site', onTabChange }: SiteDetailProps) {
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const { state, flow, addAudit } = useOperations();
  const [siteDetails, setSiteDetails] = useState<SiteDetailsData>(() => {
    try {
      const stored = localStorage.getItem(`plug_site_details_${SITE.id}`);
      if (stored) return { ...DEFAULT_SITE_DETAILS, ...JSON.parse(stored) };
    } catch { }
    return DEFAULT_SITE_DETAILS;
  });
  const [isEditingSite, setIsEditingSite] = useState(false);
  const [editSiteForm, setEditSiteForm] = useState<SiteDetailsData>(siteDetails);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const handleSaveSite = () => {
    try {
      localStorage.setItem(`plug_site_details_${SITE.id}`, JSON.stringify(editSiteForm));
    } catch { }
    setSiteDetails(editSiteForm);
    setIsEditingSite(false);
    if (typeof addAudit === 'function') {
      addAudit(
        'Site details updated',
        `Site details updated for ${editSiteForm.name} (Capacity: ${editSiteForm.capacityMW} MW, Status: ${editSiteForm.status}).`
      );
    }
    setSaveSuccessMsg('Site details saved successfully.');
    setTimeout(() => setSaveSuccessMsg(null), 4000);
  };

  const handleCancelSite = () => {
    setEditSiteForm(siteDetails);
    setIsEditingSite(false);
  };

  // Primary Contact State
  const [primaryContact, setPrimaryContact] = useState<PrimaryContactData>(() => {
    try {
      const stored = localStorage.getItem(`plug_primary_contact_${SITE.id}`);
      if (stored) return { ...DEFAULT_PRIMARY_CONTACT, ...JSON.parse(stored) };
    } catch { }
    return DEFAULT_PRIMARY_CONTACT;
  });
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [editContactForm, setEditContactForm] = useState<PrimaryContactData>(primaryContact);
  const [contactSuccessMsg, setContactSuccessMsg] = useState<string | null>(null);

  const handleSaveContact = () => {
    try {
      localStorage.setItem(`plug_primary_contact_${SITE.id}`, JSON.stringify(editContactForm));
    } catch { }
    setPrimaryContact(editContactForm);
    setIsEditingContact(false);
    if (typeof addAudit === 'function') {
      addAudit(
        'Primary contact updated',
        `Primary contact updated to ${editContactForm.nameRole} (${editContactForm.email}).`
      );
    }
    setContactSuccessMsg('Primary contact saved successfully.');
    setTimeout(() => setContactSuccessMsg(null), 4000);
  };

  const handleCancelContact = () => {
    setEditContactForm(primaryContact);
    setIsEditingContact(false);
  };

  // Location State
  const [location, setLocation] = useState<SiteLocationData>(() => {
    try {
      const stored = localStorage.getItem(`plug_site_location_${SITE.id}`);
      if (stored) return { ...DEFAULT_SITE_LOCATION, ...JSON.parse(stored) };
    } catch { }
    return DEFAULT_SITE_LOCATION;
  });
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [editLocationForm, setEditLocationForm] = useState<SiteLocationData>(location);
  const [locationSuccessMsg, setLocationSuccessMsg] = useState<string | null>(null);

  const handleSaveLocation = () => {
    try {
      localStorage.setItem(`plug_site_location_${SITE.id}`, JSON.stringify(editLocationForm));
    } catch { }
    setLocation(editLocationForm);
    setIsEditingLocation(false);
    if (typeof addAudit === 'function') {
      addAudit(
        'Site location updated',
        `Location updated to ${editLocationForm.latitude}, ${editLocationForm.longitude} (${editLocationForm.address}).`
      );
    }
    setLocationSuccessMsg('Location details saved successfully.');
    setTimeout(() => setLocationSuccessMsg(null), 4000);
  };

  const handleCancelLocation = () => {
    setEditLocationForm(location);
    setIsEditingLocation(false);
  };

  const getMapLink = (lat: string, lng: string) => {
    const cleanLat = lat.replace(/[^\d.-]/g, '');
    const cleanLng = lng.replace(/[^\d.-]/g, '');
    if (cleanLat && cleanLng) {
      return `https://maps.google.com/?q=${cleanLat},${cleanLng}`;
    }
    return `https://maps.google.com/?q=${encodeURIComponent(location.address)}`;
  };

  const [assetsList, setAssetsList] = useState<AssetItem[]>(() => {
    try {
      const stored = localStorage.getItem(`plug_site_assets_${SITE.id}`);
      if (stored) return JSON.parse(stored);
    } catch {}
    return ASSETS;
  });
  const [assetToDelete, setAssetToDelete] = useState<AssetItem | null>(null);
  const [assetSuccessMsg, setAssetSuccessMsg] = useState<string | null>(null);
  const [deletedAssetBackup, setDeletedAssetBackup] = useState<AssetItem | null>(null);

  const assets: AssetItem[] = assetsList.map(asset =>
    asset.name === "Grid Connection"
      ? {
          ...asset,
          remote: state.gridRemoteAvailable ? "Available ✓" : "Not available —",
          bob: state.gridControlGranted ? "Granted & verified" : null,
          bobLink: state.gridControlGranted ? "Review permission" : null,
        }
      : asset
  );

  const confirmDeleteAsset = () => {
    if (!assetToDelete) return;
    const toRemove = assetToDelete;
    const updated = assetsList.filter(a => a.name !== toRemove.name);
    setAssetsList(updated);
    try {
      localStorage.setItem(`plug_site_assets_${SITE.id}`, JSON.stringify(updated));
    } catch {}
    setDeletedAssetBackup(toRemove);
    setAssetSuccessMsg(`Asset "${toRemove.name}" was removed from the site.`);
    setAssetToDelete(null);

    if (typeof addAudit === 'function') {
      addAudit(
        'Asset deleted',
        `Asset "${toRemove.name}" (${toRemove.type}) was removed from ${siteDetails.name}.`
      );
    }
    setTimeout(() => {
      setAssetSuccessMsg(null);
    }, 5000);
  };

  const handleUndoDelete = () => {
    if (!deletedAssetBackup) return;
    const restored = [...assetsList, deletedAssetBackup];
    setAssetsList(restored);
    try {
      localStorage.setItem(`plug_site_assets_${SITE.id}`, JSON.stringify(restored));
    } catch {}
    if (typeof addAudit === 'function') {
      addAudit(
        'Asset restored',
        `Asset "${deletedAssetBackup.name}" was restored to ${siteDetails.name}.`
      );
    }
    setDeletedAssetBackup(null);
    setAssetSuccessMsg(`Asset "${deletedAssetBackup.name}" restored.`);
    setTimeout(() => setAssetSuccessMsg(null), 3000);
  };

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
            <p {...ibm('SemiBold', 'text-[#161616] text-[16px]')}>{siteDetails.name.replace(/ Site$/i, '') || siteDetails.name}</p>
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
            { text: siteDetails.name, clickable: false },
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
                {siteDetails.name} · <span className="font-mono text-[#525252] font-semibold">{siteDetails.id}</span>
              </p>
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              <Tag
                text={siteDetails.status}
                color={
                  siteDetails.status === 'Operational' ? 'green' :
                  siteDetails.status === 'Maintenance' ? 'orange' :
                  siteDetails.status === 'Degraded' ? 'orange' : 'gray'
                }
              />
              <Tag text={siteDetails.type} color="gray" />
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-[2px] border border-[#e0e0e0] bg-[#f4f4f4] shrink-0 max-sm:flex-wrap">
                <p className="font-mono font-medium text-[#525252] text-[12px] whitespace-nowrap max-sm:whitespace-normal">
                  {siteDetails.capacityMW} MW · {flow.soc}% SOC
                </p>
              </div>
            </div>
            <p {...ibm('Regular', 'text-[#525252] text-[14px] leading-normal')}>
              {location.gridRegion.includes('Andhra') ? 'Andhra Pradesh, India' : (location.address.split(',').slice(-2).join(',').trim() || location.gridRegion)} · Commissioned {siteDetails.commissionedDate} · Snapshot <span className="font-mono text-[#161616]">{SNAPSHOT_14_32.timestamp}</span>
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
            <div className="flex items-center gap-3">
              <p {...ibm('SemiBold', 'text-[#161616] text-[20px]')}>Site details</p>
              {isEditingSite && (
                <span className="bg-[#edf5ff] border border-[#a6c8ff] text-[#0f62fe] px-2 py-0.5 text-[11px] font-['IBM Plex Sans:SemiBold'] font-semibold rounded-[2px]">
                  Editing
                </span>
              )}
            </div>
            {!isEditingSite ? (
              <button
                type="button"
                onClick={() => {
                  setEditSiteForm(siteDetails);
                  setIsEditingSite(true);
                }}
                className="border border-[#e0e0e0] flex items-center px-4 py-2.5 rounded-[2px] hover:bg-[#edf5ff] hover:border-[#0f62fe] transition-colors cursor-pointer max-sm:flex-wrap"
              >
                <p {...ibm('Medium', 'text-[#0f62fe] text-[14px]')}>Edit</p>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCancelSite}
                  className="px-3.5 py-2 border border-[#8d8d8d] text-[#161616] hover:bg-[#f4f4f4] rounded-[2px] text-[13px] font-['IBM Plex Sans:Medium'] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveSite}
                  className="px-4 py-2 bg-[#0f62fe] text-white hover:bg-[#0043ce] rounded-[2px] text-[13px] font-['IBM Plex Sans:SemiBold'] font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <svg className="size-3.5" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z" />
                  </svg>
                  Save changes
                </button>
              </div>
            )}
          </div>

          {saveSuccessMsg && (
            <div className="bg-[#defbe6] border-l-4 border-[#198038] px-3 py-2 rounded-[2px] flex items-center justify-between">
              <p className="text-[13px] font-['IBM Plex Sans:Medium'] text-[#198038]">{saveSuccessMsg}</p>
              <button onClick={() => setSaveSuccessMsg(null)} className="text-[#198038] text-xs hover:underline cursor-pointer">Dismiss</button>
            </div>
          )}

          {!isEditingSite ? (
            <div className="flex flex-col gap-3">
              <DetailRow label="Site name"><DetailText value={siteDetails.name} /></DetailRow>
              <DetailRow label="Site ID"><DetailText value={siteDetails.id} mono={true} /></DetailRow>
              <DetailRow label="Site type"><DetailText value={siteDetails.type} /></DetailRow>
              <DetailRow label="Capacity">
                <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#525252] text-[14px] leading-normal text-right">
                  <span className="font-mono font-medium text-[#161616]">{siteDetails.capacityMW} MW</span> · {assets.length} connected {assets.length === 1 ? 'asset' : 'assets'} (<span className="font-mono font-medium text-[#161616]">{state.gridRemoteAvailable ? 2 : 1}</span> remote-controllable)
                </p>
              </DetailRow>
              <DetailRow label="Status">
                <div className={`px-2 py-0.5 rounded-[2px] border ${
                  siteDetails.status === 'Operational' ? 'bg-[#defbe6] border-[#a7f0ba]' :
                  siteDetails.status === 'Maintenance' ? 'bg-[#fef3c7] border-[#fde68a]' :
                  siteDetails.status === 'Degraded' ? 'bg-[#fff1f1] border-[#ffb3b8]' :
                  'bg-[#f4f4f4] border-[#e0e0e0]'
                }`}>
                  <p {...ibm('SemiBold', `text-[12px] ${
                    siteDetails.status === 'Operational' ? 'text-[#198038]' :
                    siteDetails.status === 'Maintenance' ? 'text-[#b26207]' :
                    siteDetails.status === 'Degraded' ? 'text-[#da1e28]' :
                    'text-[#525252]'
                  }`)}>{siteDetails.status}</p>
                </div>
              </DetailRow>
              <DetailRow label="Commissioning date"><DetailText value={siteDetails.commissionedDate} /></DetailRow>
              <DetailRow label="Owner"><DetailText value={siteDetails.owner} /></DetailRow>
              <DetailRow label="Operator"><DetailText value={siteDetails.operator} /></DetailRow>
              <DetailRow label="Time zone"><DetailText value={siteDetails.timeZone} /></DetailRow>
              <DetailRow label="Description" last>
                <DetailText value={siteDetails.description} />
              </DetailRow>
            </div>
          ) : (
            <div className="flex flex-col gap-4 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] font-['IBM Plex Sans:SemiBold'] text-[#161616]">
                    Site Name <span className="text-[#da1e28]">*</span>
                  </label>
                  <input
                    type="text"
                    value={editSiteForm.name}
                    onChange={(e) => setEditSiteForm({ ...editSiteForm, name: e.target.value })}
                    className="w-full bg-[#f4f4f4] border-b-2 border-[#161616] focus:border-[#0f62fe] px-3 py-2 text-[14px] font-['IBM Plex Sans:Regular'] text-[#161616] outline-none"
                    placeholder="e.g. Kuppam Solar Site"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] font-['IBM Plex Sans:SemiBold'] text-[#161616]">
                    Site ID
                  </label>
                  <input
                    type="text"
                    value={editSiteForm.id}
                    onChange={(e) => setEditSiteForm({ ...editSiteForm, id: e.target.value })}
                    className="w-full bg-[#f4f4f4] border-b-2 border-[#161616] focus:border-[#0f62fe] px-3 py-2 text-[14px] font-mono text-[#161616] outline-none"
                    placeholder="e.g. KUP-SOLAR-001"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] font-['IBM Plex Sans:SemiBold'] text-[#161616]">
                    Site Type
                  </label>
                  <select
                    value={editSiteForm.type}
                    onChange={(e) => setEditSiteForm({ ...editSiteForm, type: e.target.value })}
                    className="w-full bg-[#f4f4f4] border-b-2 border-[#161616] focus:border-[#0f62fe] px-3 py-2 text-[14px] font-['IBM Plex Sans:Regular'] text-[#161616] outline-none cursor-pointer"
                  >
                    <option value="Solar site">Solar site</option>
                    <option value="Wind site">Wind site</option>
                    <option value="Hybrid site">Hybrid site</option>
                    <option value="Storage site">Storage site</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] font-['IBM Plex Sans:SemiBold'] text-[#161616]">
                    Capacity (MW)
                  </label>
                  <input
                    type="number"
                    value={editSiteForm.capacityMW}
                    onChange={(e) => setEditSiteForm({ ...editSiteForm, capacityMW: Number(e.target.value) || 0 })}
                    className="w-full bg-[#f4f4f4] border-b-2 border-[#161616] focus:border-[#0f62fe] px-3 py-2 text-[14px] font-mono text-[#161616] outline-none"
                    placeholder="45"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] font-['IBM Plex Sans:SemiBold'] text-[#161616]">
                    Status
                  </label>
                  <select
                    value={editSiteForm.status}
                    onChange={(e) => setEditSiteForm({ ...editSiteForm, status: e.target.value as SiteDetailsData['status'] })}
                    className="w-full bg-[#f4f4f4] border-b-2 border-[#161616] focus:border-[#0f62fe] px-3 py-2 text-[14px] font-['IBM Plex Sans:Regular'] text-[#161616] outline-none cursor-pointer"
                  >
                    <option value="Operational">Operational</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Degraded">Degraded</option>
                    <option value="Offline">Offline</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] font-['IBM Plex Sans:SemiBold'] text-[#161616]">
                    Commissioning Date
                  </label>
                  <input
                    type="text"
                    value={editSiteForm.commissionedDate}
                    onChange={(e) => setEditSiteForm({ ...editSiteForm, commissionedDate: e.target.value })}
                    className="w-full bg-[#f4f4f4] border-b-2 border-[#161616] focus:border-[#0f62fe] px-3 py-2 text-[14px] font-['IBM Plex Sans:Regular'] text-[#161616] outline-none"
                    placeholder="e.g. 15 June 2021"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] font-['IBM Plex Sans:SemiBold'] text-[#161616]">
                    Owner
                  </label>
                  <input
                    type="text"
                    value={editSiteForm.owner}
                    onChange={(e) => setEditSiteForm({ ...editSiteForm, owner: e.target.value })}
                    className="w-full bg-[#f4f4f4] border-b-2 border-[#161616] focus:border-[#0f62fe] px-3 py-2 text-[14px] font-['IBM Plex Sans:Regular'] text-[#161616] outline-none"
                    placeholder="e.g. Kuppam Solar Site Operations"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] font-['IBM Plex Sans:SemiBold'] text-[#161616]">
                    Operator
                  </label>
                  <input
                    type="text"
                    value={editSiteForm.operator}
                    onChange={(e) => setEditSiteForm({ ...editSiteForm, operator: e.target.value })}
                    className="w-full bg-[#f4f4f4] border-b-2 border-[#161616] focus:border-[#0f62fe] px-3 py-2 text-[14px] font-['IBM Plex Sans:Regular'] text-[#161616] outline-none"
                    placeholder="e.g. Kuppam Operations Team"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[12px] font-['IBM Plex Sans:SemiBold'] text-[#161616]">
                  Time Zone
                </label>
                <input
                  type="text"
                  value={editSiteForm.timeZone}
                  onChange={(e) => setEditSiteForm({ ...editSiteForm, timeZone: e.target.value })}
                  className="w-full bg-[#f4f4f4] border-b-2 border-[#161616] focus:border-[#0f62fe] px-3 py-2 text-[14px] font-['IBM Plex Sans:Regular'] text-[#161616] outline-none"
                  placeholder="e.g. India Standard Time (UTC+5:30)"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[12px] font-['IBM Plex Sans:SemiBold'] text-[#161616]">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={editSiteForm.description}
                  onChange={(e) => setEditSiteForm({ ...editSiteForm, description: e.target.value })}
                  className="w-full bg-[#f4f4f4] border-b-2 border-[#161616] focus:border-[#0f62fe] px-3 py-2 text-[14px] font-['IBM Plex Sans:Regular'] text-[#161616] outline-none resize-y"
                  placeholder="Utility-scale solar photovoltaic installation..."
                />
              </div>
            </div>
          )}
        </SectionCard>

        {/* Primary contact */}
        <SectionCard>
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex items-center gap-3">
              <p {...ibm('SemiBold', 'text-[#161616] text-[20px]')}>Primary contact</p>
              {isEditingContact && (
                <span className="bg-[#edf5ff] border border-[#a6c8ff] text-[#0f62fe] px-2 py-0.5 text-[11px] font-['IBM Plex Sans:SemiBold'] font-semibold rounded-[2px]">
                  Editing
                </span>
              )}
            </div>
            {!isEditingContact ? (
              <button
                type="button"
                onClick={() => {
                  setEditContactForm(primaryContact);
                  setIsEditingContact(true);
                }}
                className="border border-[#e0e0e0] flex items-center px-4 py-2.5 rounded-[2px] hover:bg-[#edf5ff] hover:border-[#0f62fe] transition-colors cursor-pointer max-sm:flex-wrap"
              >
                <p {...ibm('Medium', 'text-[#0f62fe] text-[14px]')}>Edit</p>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCancelContact}
                  className="px-3.5 py-2 border border-[#8d8d8d] text-[#161616] hover:bg-[#f4f4f4] rounded-[2px] text-[13px] font-['IBM Plex Sans:Medium'] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveContact}
                  className="px-4 py-2 bg-[#0f62fe] text-white hover:bg-[#0043ce] rounded-[2px] text-[13px] font-['IBM Plex Sans:SemiBold'] font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <svg className="size-3.5" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z" />
                  </svg>
                  Save contact
                </button>
              </div>
            )}
          </div>

          {contactSuccessMsg && (
            <div className="bg-[#defbe6] border-l-4 border-[#198038] px-3 py-2 rounded-[2px] flex items-center justify-between">
              <p className="text-[13px] font-['IBM Plex Sans:Medium'] text-[#198038]">{contactSuccessMsg}</p>
              <button onClick={() => setContactSuccessMsg(null)} className="text-[#198038] text-xs hover:underline cursor-pointer">Dismiss</button>
            </div>
          )}

          {!isEditingContact ? (
            <div className="flex flex-col gap-3">
              <DetailRow label="Name / role"><DetailText value={primaryContact.nameRole} /></DetailRow>
              <DetailRow label="Email">
                <a href={`mailto:${primaryContact.email}`} className="text-[#0f62fe] text-[14px] font-['IBM Plex Sans:Regular'] font-normal hover:underline" style={{ fontVariationSettings: '"wdth" 100' }}>
                  {primaryContact.email}
                </a>
              </DetailRow>
              <DetailRow label="Phone" last><DetailText value={primaryContact.phone} mono={true} /></DetailRow>
            </div>
          ) : (
            <div className="flex flex-col gap-4 pt-1">
              <div className="flex flex-col gap-1">
                <label className="text-[12px] font-['IBM Plex Sans:SemiBold'] text-[#161616]">
                  Name / Role <span className="text-[#da1e28]">*</span>
                </label>
                <input
                  type="text"
                  value={editContactForm.nameRole}
                  onChange={(e) => setEditContactForm({ ...editContactForm, nameRole: e.target.value })}
                  className="w-full bg-[#f4f4f4] border-b-2 border-[#161616] focus:border-[#0f62fe] px-3 py-2 text-[14px] font-['IBM Plex Sans:Regular'] text-[#161616] outline-none"
                  placeholder="e.g. Bharath Kumar (Site Manager)"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] font-['IBM Plex Sans:SemiBold'] text-[#161616]">
                    Email <span className="text-[#da1e28]">*</span>
                  </label>
                  <input
                    type="email"
                    value={editContactForm.email}
                    onChange={(e) => setEditContactForm({ ...editContactForm, email: e.target.value })}
                    className="w-full bg-[#f4f4f4] border-b-2 border-[#161616] focus:border-[#0f62fe] px-3 py-2 text-[14px] font-['IBM Plex Sans:Regular'] text-[#161616] outline-none"
                    placeholder="e.g. bharath.kumar@example.com"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] font-['IBM Plex Sans:SemiBold'] text-[#161616]">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={editContactForm.phone}
                    onChange={(e) => setEditContactForm({ ...editContactForm, phone: e.target.value })}
                    className="w-full bg-[#f4f4f4] border-b-2 border-[#161616] focus:border-[#0f62fe] px-3 py-2 text-[14px] font-mono text-[#161616] outline-none"
                    placeholder="e.g. +91 98765 43210"
                  />
                </div>
              </div>
            </div>
          )}
        </SectionCard>

        {/* Location */}
        <SectionCard>
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex items-center gap-3">
              <p {...ibm('SemiBold', 'text-[#161616] text-[20px]')}>Location</p>
              {isEditingLocation && (
                <span className="bg-[#edf5ff] border border-[#a6c8ff] text-[#0f62fe] px-2 py-0.5 text-[11px] font-['IBM Plex Sans:SemiBold'] font-semibold rounded-[2px]">
                  Editing
                </span>
              )}
            </div>
            {!isEditingLocation ? (
              <button
                type="button"
                onClick={() => {
                  setEditLocationForm(location);
                  setIsEditingLocation(true);
                }}
                className="border border-[#e0e0e0] flex items-center px-4 py-2.5 rounded-[2px] hover:bg-[#edf5ff] hover:border-[#0f62fe] transition-colors cursor-pointer max-sm:flex-wrap"
              >
                <p {...ibm('Medium', 'text-[#0f62fe] text-[14px]')}>Edit</p>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCancelLocation}
                  className="px-3.5 py-2 border border-[#8d8d8d] text-[#161616] hover:bg-[#f4f4f4] rounded-[2px] text-[13px] font-['IBM Plex Sans:Medium'] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveLocation}
                  className="px-4 py-2 bg-[#0f62fe] text-white hover:bg-[#0043ce] rounded-[2px] text-[13px] font-['IBM Plex Sans:SemiBold'] font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <svg className="size-3.5" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z" />
                  </svg>
                  Save location
                </button>
              </div>
            )}
          </div>

          {locationSuccessMsg && (
            <div className="bg-[#defbe6] border-l-4 border-[#198038] px-3 py-2 rounded-[2px] flex items-center justify-between">
              <p className="text-[13px] font-['IBM Plex Sans:Medium'] text-[#198038]">{locationSuccessMsg}</p>
              <button onClick={() => setLocationSuccessMsg(null)} className="text-[#198038] text-xs hover:underline cursor-pointer">Dismiss</button>
            </div>
          )}

          {!isEditingLocation ? (
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-8 items-start">
              {/* Left: details */}
              <div className="flex flex-1 flex-col gap-4 min-w-0">
                <div className="flex flex-col gap-1">
                  <p {...ibm('SemiBold', 'text-[#161616] text-[14px]')}>Address</p>
                  <p {...ibm('Regular', 'text-[#525252] text-[14px] leading-normal')}>{location.address}</p>
                </div>
                <div className="flex gap-6 items-start max-sm:flex-wrap">
                  {[
                    { label: 'Latitude', value: location.latitude },
                    { label: 'Longitude', value: location.longitude },
                    { label: 'Elevation', value: location.elevation },
                  ].map(c => (
                    <div key={c.label} className="flex flex-col gap-1">
                      <p {...ibm('SemiBold', 'text-[#161616] text-[14px]')}>{c.label}</p>
                      <p className="font-mono text-[#525252] text-[14px] leading-normal">{c.value}</p>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col gap-1">
                  <p {...ibm('SemiBold', 'text-[#161616] text-[14px]')}>Grid region</p>
                  <p {...ibm('Regular', 'text-[#525252] text-[14px]')}>{location.gridRegion}</p>
                </div>
                <div className="flex gap-3 items-start max-sm:flex-wrap">
                  <div className="flex flex-col gap-1">
                    <p {...ibm('Regular', 'text-[#525252] text-[11px] uppercase tracking-wide')}>Weather coverage</p>
                    <div className="bg-[#defbe6] border border-[#a7f0ba] flex items-center px-2 py-0.5 rounded-[2px] max-sm:flex-wrap">
                      <p {...ibm('SemiBold', 'text-[#198038] text-[12px]')}>{location.weatherCoverage}</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <p {...ibm('Regular', 'text-[#525252] text-[11px] uppercase tracking-wide')}>Solar forecast</p>
                    <div className="bg-[#defbe6] border border-[#a7f0ba] flex items-center px-2 py-0.5 rounded-[2px] max-sm:flex-wrap">
                      <p {...ibm('SemiBold', 'text-[#198038] text-[12px]')}>{location.solarForecast}</p>
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
                    <p className="font-mono font-semibold text-[#161616] text-[12px]">{location.latitude}, {location.longitude}</p>
                  </div>
                </div>
                <a href={getMapLink(location.latitude, location.longitude)} target="_blank" rel="noopener noreferrer"
                  {...ibm('SemiBold', 'text-[#0f62fe] text-[14px] underline cursor-pointer hover:text-[#0043ce] transition-colors')}>
                  View full map
                </a>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4 pt-1">
              <div className="flex flex-col gap-1">
                <label className="text-[12px] font-['IBM Plex Sans:SemiBold'] text-[#161616]">
                  Address <span className="text-[#da1e28]">*</span>
                </label>
                <input
                  type="text"
                  value={editLocationForm.address}
                  onChange={(e) => setEditLocationForm({ ...editLocationForm, address: e.target.value })}
                  className="w-full bg-[#f4f4f4] border-b-2 border-[#161616] focus:border-[#0f62fe] px-3 py-2 text-[14px] font-['IBM Plex Sans:Regular'] text-[#161616] outline-none"
                  placeholder="e.g. Kuppam, Chittoor District, Andhra Pradesh, India"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] font-['IBM Plex Sans:SemiBold'] text-[#161616]">
                    Latitude
                  </label>
                  <input
                    type="text"
                    value={editLocationForm.latitude}
                    onChange={(e) => setEditLocationForm({ ...editLocationForm, latitude: e.target.value })}
                    className="w-full bg-[#f4f4f4] border-b-2 border-[#161616] focus:border-[#0f62fe] px-3 py-2 text-[14px] font-mono text-[#161616] outline-none"
                    placeholder="12.7480°N"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] font-['IBM Plex Sans:SemiBold'] text-[#161616]">
                    Longitude
                  </label>
                  <input
                    type="text"
                    value={editLocationForm.longitude}
                    onChange={(e) => setEditLocationForm({ ...editLocationForm, longitude: e.target.value })}
                    className="w-full bg-[#f4f4f4] border-b-2 border-[#161616] focus:border-[#0f62fe] px-3 py-2 text-[14px] font-mono text-[#161616] outline-none"
                    placeholder="78.3410°E"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] font-['IBM Plex Sans:SemiBold'] text-[#161616]">
                    Elevation
                  </label>
                  <input
                    type="text"
                    value={editLocationForm.elevation}
                    onChange={(e) => setEditLocationForm({ ...editLocationForm, elevation: e.target.value })}
                    className="w-full bg-[#f4f4f4] border-b-2 border-[#161616] focus:border-[#0f62fe] px-3 py-2 text-[14px] font-mono text-[#161616] outline-none"
                    placeholder="680m"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] font-['IBM Plex Sans:SemiBold'] text-[#161616]">
                    Grid Region
                  </label>
                  <input
                    type="text"
                    value={editLocationForm.gridRegion}
                    onChange={(e) => setEditLocationForm({ ...editLocationForm, gridRegion: e.target.value })}
                    className="w-full bg-[#f4f4f4] border-b-2 border-[#161616] focus:border-[#0f62fe] px-3 py-2 text-[14px] font-['IBM Plex Sans:Regular'] text-[#161616] outline-none"
                    placeholder="e.g. Andhra Pradesh DISCOM"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] font-['IBM Plex Sans:SemiBold'] text-[#161616]">
                    Weather Coverage
                  </label>
                  <select
                    value={editLocationForm.weatherCoverage}
                    onChange={(e) => setEditLocationForm({ ...editLocationForm, weatherCoverage: e.target.value })}
                    className="w-full bg-[#f4f4f4] border-b-2 border-[#161616] focus:border-[#0f62fe] px-3 py-2 text-[14px] font-['IBM Plex Sans:Regular'] text-[#161616] outline-none cursor-pointer"
                  >
                    <option value="Available">Available</option>
                    <option value="Limited">Limited</option>
                    <option value="Offline">Offline</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] font-['IBM Plex Sans:SemiBold'] text-[#161616]">
                    Solar Forecast
                  </label>
                  <select
                    value={editLocationForm.solarForecast}
                    onChange={(e) => setEditLocationForm({ ...editLocationForm, solarForecast: e.target.value })}
                    className="w-full bg-[#f4f4f4] border-b-2 border-[#161616] focus:border-[#0f62fe] px-3 py-2 text-[14px] font-['IBM Plex Sans:Regular'] text-[#161616] outline-none cursor-pointer"
                  >
                    <option value="Available">Available</option>
                    <option value="Limited">Limited</option>
                    <option value="Offline">Offline</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </SectionCard>

        {/* Assets */}
        <SectionCard>
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex gap-3 items-center max-sm:flex-wrap">
              <p {...ibm('SemiBold', 'text-[#161616] text-[20px]')}>Assets</p>
              <div className="bg-[#f4f4f4] border border-[#e0e0e0] flex items-center px-2 py-0.5 rounded-[2px] max-sm:flex-wrap">
                <p {...ibm('SemiBold', 'text-[#161616] text-[11px]')}>
                  {assets.length} {assets.length === 1 ? 'asset' : 'assets'} · {assets.filter(a => a.remote.includes('✓') || a.bob).length} control systems
                </p>
              </div>
            </div>
            <button type="button" onClick={onConnectData} className="bg-[#0f62fe] flex gap-2 items-center min-h-11 px-4 py-2.5 rounded-[2px] hover:bg-[#0043ce] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f62fe] transition-colors cursor-pointer max-sm:flex-wrap">
              <img alt="" className="size-4" src={imgPlus} />
              <p {...ibm('Medium', 'text-white text-[14px]')}>Add asset</p>
            </button>
          </div>

          {assetSuccessMsg && (
            <div className="bg-[#defbe6] border-l-4 border-[#198038] px-3 py-2 rounded-[2px] flex items-center justify-between">
              <p className="text-[13px] font-['IBM Plex Sans:Medium'] text-[#198038]">{assetSuccessMsg}</p>
              <div className="flex items-center gap-3">
                {deletedAssetBackup && (
                  <button type="button" onClick={handleUndoDelete} className="text-[#0f62fe] text-xs font-semibold hover:underline cursor-pointer">Undo</button>
                )}
                <button type="button" onClick={() => setAssetSuccessMsg(null)} className="text-[#198038] text-xs hover:underline cursor-pointer">Dismiss</button>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="flex flex-col w-full overflow-x-auto focus-visible:outline-2 focus-visible:outline-[#0f62fe]" role="region" aria-label="Site assets table" tabIndex={0} data-table="assets">
            {/* Header */}
            <div className="bg-[#f4f4f4] border-b border-[#e0e0e0] grid grid-cols-[180px_170px_150px_130px_120px_150px_minmax(240px,1fr)_56px] gap-4 min-w-[1308px] items-center [&>p]:w-auto [&>div]:w-auto px-4 py-3">
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
              <div className="w-[56px] shrink-0 text-right">
                <span className="sr-only">Actions</span>
              </div>
            </div>

            {/* Rows */}
            {assets.length === 0 ? (
              <div className="py-8 px-4 flex flex-col items-center justify-center gap-2 text-center bg-[#fafafa]">
                <p {...ibm('Medium', 'text-[#525252] text-[14px]')}>No assets listed for this site.</p>
                <button
                  type="button"
                  onClick={() => {
                    setAssetsList(ASSETS);
                    try {
                      localStorage.removeItem(`plug_site_assets_${SITE.id}`);
                    } catch {}
                  }}
                  className="text-[#0f62fe] text-[13px] hover:underline font-['IBM Plex Sans:Medium'] cursor-pointer"
                >
                  Reset default assets
                </button>
              </div>
            ) : (
              assets.map((asset, i) => (
                <div key={asset.name} className={`grid grid-cols-[180px_170px_150px_130px_120px_150px_minmax(240px,1fr)_56px] gap-4 min-w-[1308px] items-center [&>p]:w-auto [&>div]:w-auto px-4 py-3.5 ${i < assets.length - 1 ? 'border-b border-[#e0e0e0]' : ''}`}>
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
                  <div className="w-[56px] flex justify-end shrink-0">
                    <button
                      type="button"
                      onClick={() => setAssetToDelete(asset)}
                      title={`Delete ${asset.name}`}
                      aria-label={`Delete ${asset.name}`}
                      className="size-8 flex items-center justify-center rounded-[2px] text-[#525252] hover:text-[#da1e28] hover:bg-[#fff1f1] transition-colors cursor-pointer group"
                    >
                      <svg className="size-4 transition-transform group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
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

      {/* Delete Asset Confirmation Modal */}
      {assetToDelete && (
        <div className="fixed inset-0 z-50 bg-[#161616]/60 backdrop-blur-[1px] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="delete-asset-title">
          <div className="bg-white border border-[#e0e0e0] max-w-[480px] w-full rounded-[2px] shadow-2xl flex flex-col overflow-hidden animate-in fade-in duration-150">
            {/* Modal Header */}
            <div className="px-6 pt-5 pb-3 border-b border-[#e0e0e0] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-full bg-[#fff1f1] flex items-center justify-center text-[#da1e28]">
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <p id="delete-asset-title" {...ibm('SemiBold', 'text-[#161616] text-[18px]')}>Delete asset</p>
              </div>
              <button
                type="button"
                onClick={() => setAssetToDelete(null)}
                aria-label="Close dialog"
                className="text-[#525252] hover:text-[#161616] p-1 rounded-[2px] cursor-pointer"
              >
                <svg className="size-4" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-4 flex flex-col gap-3">
              <p {...ibm('Regular', 'text-[#525252] text-[14px] leading-relaxed')}>
                Are you sure you want to delete <span className="font-semibold text-[#161616]">{assetToDelete.name}</span> ({assetToDelete.type})?
              </p>
              <div className="bg-[#f4f4f4] border-l-2 border-[#da1e28] p-3 text-[12px] text-[#525252] font-['IBM Plex Sans:Regular']">
                This action will detach associated telemetry, monitoring feeds, and automation permissions from this site.
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 bg-[#f4f4f4] border-t border-[#e0e0e0] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setAssetToDelete(null)}
                className="px-4 py-2 border border-[#8d8d8d] text-[#161616] hover:bg-[#e0e0e0] rounded-[2px] text-[13px] font-['IBM Plex Sans:Medium'] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteAsset}
                className="px-4 py-2 bg-[#da1e28] text-white hover:bg-[#ba1b23] rounded-[2px] text-[13px] font-['IBM Plex Sans:SemiBold'] font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete asset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
