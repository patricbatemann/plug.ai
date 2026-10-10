import { useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import BobToggle from './BobToggle';
import { configApi, portfolioApi, siteApi, type Asset, type SiteProfile } from './api/client';
import { SITE } from './data';
import { configKindLabel, kindLabel, simDateTime } from './format';
import { useSite } from './site';

const assetPathPrefix = '/assets';
const imgIconSun = `${assetPathPrefix}/31b52.svg`;
const imgIconBot = `${assetPathPrefix}/8be4b.svg`;
const imgEllipse = `${assetPathPrefix}/71d6b.svg`;
const imgMapPin = `${assetPathPrefix}/73303.svg`;

interface SiteDetailProps {
  onBack: () => void;
  onLiveOverview?: () => void;
  onBob?: () => void;
  onConnectData?: () => void;
}

function ibm(w: 'Regular' | 'Medium' | 'SemiBold' | 'Bold', extra = '') {
  const wt = { Regular: 'normal', Medium: 'medium', SemiBold: 'semibold', Bold: 'bold' }[w];
  return { className: `font-['IBM Plex Sans:${w}'] font-${wt} ${extra}`, style: { fontVariationSettings: '"wdth" 100' } };
}

const TONES = {
  green: 'bg-[#defbe6] border-[#a7f0ba] text-[#198038]',
  gray: 'bg-[#f4f4f4] border-[#e0e0e0] text-[#525252]',
  purple: 'bg-[#f4f0ff] border-[#d4bbff] text-[#8a3ffc]',
  orange: 'bg-[#fef3c7] border-[#fde68a] text-[#b26207]',
  red: 'bg-[#fff1f1] border-[#ffb3b8] text-[#da1e28]',
};
const STATUS_TONE: Record<SiteProfile['status'], keyof typeof TONES> = {
  Operational: 'green', Maintenance: 'orange', Degraded: 'red', Offline: 'gray',
};

function Tag({ text, tone }: { text: string; tone: keyof typeof TONES }) {
  return <span {...ibm('SemiBold', `px-2 py-1 rounded-[2px] border text-[12px] whitespace-nowrap ${TONES[tone]}`)}>{text}</span>;
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-start pb-3 border-b border-[#e0e0e0] last:border-0">
      <p {...ibm('SemiBold', 'text-[#161616] text-[14px] w-full sm:w-[200px] shrink-0')}>{label}</p>
      <div {...ibm('Regular', 'flex flex-1 min-w-0 sm:justify-end text-[#525252] text-[14px] text-right')}>{children}</div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="flex flex-col gap-1 text-[13px] text-[#525252]">
      {label}
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="min-h-10 border-b border-[#8d8d8d] bg-[#f4f4f4] px-3 text-[14px] text-[#161616] focus:outline-2 focus:outline-[#0f62fe]" />
    </label>
  );
}

/** A card of profile fields: shown as rows, edited in place, saved with the rest of the profile. */
function ProfileCard({ title, rows, edit, onSave }: {
  title: string;
  rows: Array<[string, ReactNode]>;
  edit: (draft: SiteProfile, set: (d: SiteProfile) => void) => ReactNode;
  onSave: (draft: SiteProfile) => Promise<void>;
}) {
  const { info } = useSite();
  const [draft, setDraft] = useState<SiteProfile | null>(null);
  const [error, setError] = useState('');
  const save = async () => {
    if (!draft) return;
    setError('');
    try {
      await onSave(draft);
      setDraft(null);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Not saved.');
    }
  };
  return (
    <section className="bg-white border border-[#e0e0e0] flex flex-col gap-4 p-6 rounded-[2px] w-full">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <p {...ibm('SemiBold', 'text-[#161616] text-[20px]')}>{title}</p>
        {!draft ? (
          <button type="button" disabled={!info} onClick={() => info && setDraft(structuredClone(info.profile))} className="border border-[#e0e0e0] px-4 py-2.5 rounded-[2px] hover:bg-[#edf5ff] hover:border-[#0f62fe] transition-colors cursor-pointer text-[14px] text-[#0f62fe]">Edit</button>
        ) : (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => { setDraft(null); setError(''); }} className="px-3.5 py-2 border border-[#8d8d8d] text-[#161616] hover:bg-[#f4f4f4] rounded-[2px] text-[13px] cursor-pointer">Cancel</button>
            <button type="button" onClick={() => void save()} className="px-4 py-2 bg-[#0f62fe] text-white hover:bg-[#0043ce] rounded-[2px] text-[13px] font-semibold cursor-pointer">Save changes</button>
          </div>
        )}
      </div>
      {error && <p role="alert" className="border-l-4 border-[#da1e28] bg-[#fff1f1] px-3 py-2 text-[13px] text-[#161616]">{error}</p>}
      {draft ? <div className="grid gap-4 sm:grid-cols-2">{edit(draft, setDraft)}</div> : (
        <div className="flex flex-col gap-3">{rows.map(([label, value]) => <DetailRow key={label} label={label}>{value || '—'}</DetailRow>)}</div>
      )}
    </section>
  );
}

const capacity = (a: Asset) =>
  a.kind === 'bess' ? `${a.params.energy_mwh} MWh / ${a.capacity_mw} MW` : a.capacity_mw ? `${a.capacity_mw} MW` : '—';

export default function SiteDetail({ onBack, onLiveOverview, onBob, onConnectData }: SiteDetailProps) {
  const queryClient = useQueryClient();
  const { info, live, battery, bobActive, configs, siteName } = useSite();
  const options = useQuery({ queryKey: ['config-options', SITE.id], queryFn: () => configApi.options(SITE.id) }).data;
  const sources = useQuery({ queryKey: ['data-sources', SITE.id], queryFn: () => siteApi.sources(SITE.id) }).data ?? [];
  const profile = info?.profile;
  const generation = info?.assets.filter((a) => a.kind === 'solar' || a.kind === 'wind').reduce((sum, a) => sum + a.capacity_mw, 0) ?? 0;
  const controllable = (code: string) => (options?.assets.find((a) => a.code === code)?.actions.length ?? 0) > 0;
  const granted = (code: string) => configs.filter((c) => c.asset === code && c.status === 'active');
  const saveProfile = async (draft: SiteProfile) => {
    const saved = await portfolioApi.saveProfile(SITE.id, draft);
    queryClient.setQueryData(['site', SITE.id], saved);
  };
  const number = (v: string) => (v.trim() === '' ? null : Number(v));
  const coordinates = profile?.latitude != null && profile.longitude != null ? `${profile.latitude}, ${profile.longitude}` : '';

  return (
    <div className="bg-[#f4f4f4] min-h-screen w-full">
      <header className="bg-white border-b border-[#e0e0e0] flex flex-wrap gap-6 items-center min-h-12 py-3 px-4 md:px-6">
        <div className="flex gap-2 items-center">
          <img alt="" className="size-6" src={imgEllipse} />
          <p {...ibm('SemiBold', 'text-[#161616] text-[16px]')}>{siteName}</p>
        </div>
        <nav className="flex gap-6 items-center">
          <div className="flex flex-col gap-1 items-center">
            <p {...ibm('SemiBold', 'text-[#0f62fe] text-[13px]')}>Site</p>
            <div className="bg-[#0f62fe] h-0.5 w-6" />
          </div>
          <button onClick={onBob} {...ibm('Medium', 'text-[#525252] text-[13px] cursor-pointer hover:text-[#161616]')}>BOB</button>
        </nav>
      </header>

      <div className="bg-white border-b border-[#e0e0e0] flex flex-col gap-3 px-6 py-4">
        <div className="flex gap-2 items-center text-[13px] text-[#525252]">
          <button onClick={onBack} className="hover:text-[#0f62fe]">Sites</button><span className="text-[#8d8d8d]">/</span>
          <span>{siteName}</span><span className="text-[#8d8d8d]">/</span><span>Site Details</span>
        </div>
        <div className="flex flex-col lg:flex-row gap-4 items-start justify-between">
          <div className="flex flex-col gap-2 flex-1 min-w-0">
            <div className="flex gap-3 items-center max-sm:flex-wrap">
              <div className="bg-[#fef8ed] flex items-center justify-center rounded-[2px] size-8 shrink-0"><img alt="" className="size-6" src={imgIconSun} /></div>
              <p {...ibm('Bold', 'text-[#161616] text-[24px]')}>{siteName} · <span className="font-mono text-[#525252] font-semibold">{SITE.id}</span></p>
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              {profile && <Tag text={profile.status} tone={STATUS_TONE[profile.status]} />}
              {info && <Tag text={kindLabel(info.kind)} tone="gray" />}
              <Tag text={`${generation} MW${battery ? ` · ${battery.soc_pct}% SOC` : ''}`} tone="gray" />
            </div>
            {info && <p {...ibm('Regular', 'text-[#525252] text-[14px]')}>{info.location} · Commissioned {new Date(info.commissioned_on).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>}
          </div>
          <div className="flex gap-3 items-center flex-wrap lg:justify-end">
            <span className={`flex gap-1.5 items-center px-2 py-1 rounded-[2px] border ${TONES.purple}`}><img alt="" className="size-4" src={imgIconBot} /><span className="text-[12px] font-semibold">{bobActive ? 'BOB active' : 'BOB paused'}</span></span>
            <Tag text={live?.connected ? 'Data: Live' : 'Data: Not connected'} tone={live?.connected ? 'green' : 'gray'} />
            {info && <Tag text={`Mode: ${info.mode_code.replace(/_/g, ' ')}`} tone="gray" />}
            <BobToggle />
            <button onClick={onBob} className="bg-[#0f62fe] px-4 py-2 rounded-[2px] cursor-pointer hover:bg-[#0043ce] transition-colors text-white text-[13px] font-semibold">Configure AI Actions</button>
          </div>
        </div>
        <p {...ibm('Regular', 'text-[#525252] text-[13px]')}>
          {live ? <>Readings as of <span className="font-mono text-[#161616]">{simDateTime(live.as_of)} IST</span> · telemetry {live.connected ? 'connected' : 'not connected'}</> : 'Loading readings…'}
        </p>
      </div>

      <div className="bg-white border-b border-[#e0e0e0] flex gap-8 items-center h-12 overflow-x-auto px-4 md:px-6">
        {([['site', 'Site Details'], ['live', 'Live Overview']] as const).map(([id, label]) => (
          <button key={id} className="flex min-h-11 shrink-0 flex-col justify-center gap-1 items-center cursor-pointer"
            onClick={() => { if (id === 'live') onLiveOverview?.(); }}>
            <p {...ibm(id === 'site' ? 'SemiBold' : 'Medium', `${id === 'site' ? 'text-[#0f62fe]' : 'text-[#525252] hover:text-[#161616]'} text-[13px]`)}>{label}</p>
            <div className={`${id === 'site' ? 'bg-[#0f62fe]' : 'bg-transparent'} h-0.5 w-full`} />
          </button>
        ))}
      </div>

      <main className="flex flex-col gap-6 px-4 md:px-6 py-6 w-full">
        <ProfileCard title="Site details" onSave={saveProfile}
          rows={[
            ['Site name', siteName],
            ['Site ID', <span className="font-mono">{SITE.id}</span>],
            ['Site type', info ? kindLabel(info.kind) : ''],
            ['Capacity', `${generation} MW · ${info?.assets.length ?? 0} assets`],
            ['Status', profile && <Tag text={profile.status} tone={STATUS_TONE[profile.status]} />],
            ['Owner', profile?.owner],
            ['Operator', profile?.operator],
            ['Time zone', info?.tz],
            ['Description', profile?.description],
          ]}
          edit={(d, set) => <>
            <label className="flex flex-col gap-1 text-[13px] text-[#525252]">Status
              <select value={d.status} onChange={(e) => set({ ...d, status: e.target.value as SiteProfile['status'] })} className="min-h-10 border-b border-[#8d8d8d] bg-[#f4f4f4] px-3 text-[14px] text-[#161616]">
                {Object.keys(STATUS_TONE).map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
            <Field label="Owner" value={d.owner} onChange={(v) => set({ ...d, owner: v })} />
            <Field label="Operator" value={d.operator} onChange={(v) => set({ ...d, operator: v })} />
            <Field label="Description" value={d.description} onChange={(v) => set({ ...d, description: v })} />
          </>} />

        <div className="grid gap-6 xl:grid-cols-2 items-start">
        <ProfileCard title="Primary contact" onSave={saveProfile}
          rows={[
            ['Name and role', profile && [profile.contact.name, profile.contact.role].filter(Boolean).join(' · ')],
            ['Email', profile?.contact.email && <a href={`mailto:${profile.contact.email}`} className="text-[#0f62fe] underline">{profile.contact.email}</a>],
            ['Phone', profile?.contact.phone && <a href={`tel:${profile.contact.phone.replace(/\s/g, '')}`} className="font-mono text-[#0f62fe] underline">{profile.contact.phone}</a>],
          ]}
          edit={(d, set) => <>
            <Field label="Name" value={d.contact.name} onChange={(v) => set({ ...d, contact: { ...d.contact, name: v } })} />
            <Field label="Role" value={d.contact.role} onChange={(v) => set({ ...d, contact: { ...d.contact, role: v } })} />
            <Field label="Email" type="email" value={d.contact.email} onChange={(v) => set({ ...d, contact: { ...d.contact, email: v } })} />
            <Field label="Phone" type="tel" value={d.contact.phone} onChange={(v) => set({ ...d, contact: { ...d.contact, phone: v } })} />
          </>} />

        <ProfileCard title="Location" onSave={saveProfile}
          rows={[
            ['Address', profile?.address],
            ['Coordinates', coordinates && <a href={`https://maps.google.com/?q=${profile!.latitude},${profile!.longitude}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-mono text-[#0f62fe] underline"><img alt="" className="size-4" src={imgMapPin} />{coordinates}</a>],
            ['Elevation', profile?.elevation_m != null ? `${profile.elevation_m} m` : ''],
            ['Grid region', profile?.grid_region],
          ]}
          edit={(d, set) => <>
            <Field label="Address" value={d.address} onChange={(v) => set({ ...d, address: v })} />
            <Field label="Grid region" value={d.grid_region} onChange={(v) => set({ ...d, grid_region: v })} />
            <Field label="Latitude" type="number" value={d.latitude?.toString() ?? ''} onChange={(v) => set({ ...d, latitude: number(v) })} />
            <Field label="Longitude" type="number" value={d.longitude?.toString() ?? ''} onChange={(v) => set({ ...d, longitude: number(v) })} />
            <Field label="Elevation (m)" type="number" value={d.elevation_m?.toString() ?? ''} onChange={(v) => set({ ...d, elevation_m: number(v) })} />
          </>} />
        </div>

        <section className="bg-white border border-[#e0e0e0] flex flex-col gap-4 p-6 rounded-[2px]">
          <p {...ibm('SemiBold', 'text-[#161616] text-[20px]')}>Assets</p>
          <div className="overflow-x-auto" role="region" aria-label="Site assets" tabIndex={0}>
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead className="bg-[#f4f4f4] text-[#525252]">
                <tr>{['Asset', 'Type', 'Capacity', 'Status', 'Monitoring', 'Remote control', 'BOB permission'].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr>
              </thead>
              <tbody>
                {info?.assets.map((a) => (
                  <tr key={a.code} className="border-b border-[#e0e0e0]">
                    <td className="px-4 py-3"><p className="font-semibold text-[#161616]">{a.name}</p><p className="font-mono text-[12px] text-[#8d8d8d]">{a.code}</p></td>
                    <td className="px-4 py-3">{kindLabel(a.kind)}</td>
                    <td className="px-4 py-3 font-mono">{capacity(a)}</td>
                    <td className="px-4 py-3"><Tag text={a.active ? 'Active' : 'Inactive'} tone={a.active ? 'green' : 'gray'} /></td>
                    <td className="px-4 py-3">{live?.connected ? 'Live feed' : 'Not connected'}</td>
                    <td className="px-4 py-3">{controllable(a.code) ? 'Available' : 'Not available'}</td>
                    <td className="px-4 py-3">
                      {granted(a.code).length ? <button onClick={onBob} className="text-[#0f62fe] underline cursor-pointer">{granted(a.code).map((c) => configKindLabel(c.kind)).join(', ')}</button> : 'Not granted'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-white border border-[#e0e0e0] flex flex-col gap-4 p-6 rounded-[2px]">
          <p {...ibm('SemiBold', 'text-[#161616] text-[20px]')}>Data access and permissions</p>
          <div className="grid gap-6 md:grid-cols-3 text-[13px]">
            <div className="flex flex-col gap-2">
              <p className="font-semibold text-[#161616]">Data sources</p>
              {sources.length === 0 && <p className="text-[#525252]">None connected.</p>}
              {sources.map((s) => <p key={s.id} className="break-all text-[#525252]">{s.kind === 'api' ? 'Live API' : 'CSV'} · {s.name}</p>)}
              <button onClick={onConnectData} className="self-start text-[#0f62fe] underline cursor-pointer">Connect data</button>
            </div>
            <div className="flex flex-col gap-2">
              <p className="font-semibold text-[#161616]">Remote control</p>
              {info?.assets.map((a) => <p key={a.code} className="text-[#525252]">{a.name}: {controllable(a.code) ? 'available' : 'not available'}</p>)}
            </div>
            <div className="flex flex-col gap-2">
              <p className="font-semibold text-[#161616]">BOB control permissions</p>
              <p className="text-[#525252]">{live?.connected ? 'BOB acts on the assets below within their configurations.' : 'BOB only monitors until the site’s telemetry is connected.'}</p>
              {configs.map((c) => <p key={c.id} className="text-[#525252]">{c.asset_name} · {configKindLabel(c.kind)}: {c.status}</p>)}
              <button onClick={onBob} className="self-start text-[#0f62fe] underline cursor-pointer">Review control permissions</button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
