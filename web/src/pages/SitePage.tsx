import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Breadcrumb,
  BreadcrumbItem,
  Button,
  InlineNotification,
  SkeletonText,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Tag,
} from '@carbon/react'
import { portfolioApi, siteApi } from '../api/client'
import { assetSummary, kindLabel, mw } from '../format'
import { LiveOverview } from '../runs/LiveOverview'
import { ModeTag } from '../runs/ModeTag'
import { SiteActions } from '../runs/SiteActions'
import { SiteActivity } from '../runs/SiteActivity'
import { SiteMaintenance } from '../runs/SiteMaintenance'
import { useCurrentRun } from '../runs/useCurrentRun'

export function SitePage() {
  const { code = '' } = useParams()
  const { data, error } = useQuery({ queryKey: ['site', code], queryFn: () => portfolioApi.site(code) })
  const { data: run } = useCurrentRun()
  const [tab, setTab] = useState<number | null>(null)
  const navigate = useNavigate()

  if (error) return <InlineNotification kind="error" title="Could not load the site" subtitle={error.message} hideCloseButton lowContrast />
  if (!data) return <SkeletonText paragraph lineCount={6} />

  const generation = data.assets
    .filter((a) => a.kind === 'solar' || a.kind === 'wind')
    .reduce((sum, a) => sum + a.capacity_mw, 0)

  return (
    <>
      <Breadcrumb noTrailingSlash>
        <BreadcrumbItem>
          <Link to="/portfolio">Portfolio</Link>
        </BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>{data.name}</BreadcrumbItem>
      </Breadcrumb>
      <div className="page-head">
        <h1 className="page-title">
          {data.name} · {data.code}
        </h1>
        <div className="tag-row">
          <Button kind="ghost" onClick={() => navigate('/simulation')}>Run simulation</Button>
          <Button kind="tertiary" onClick={() => navigate(`/sites/${data.code}/bob`)}>Configure BOB</Button>
        </div>
      </div>
      <p className="page-meta">
        {data.location} · Commissioned {data.commissioned_on.slice(0, 4)}
      </p>
      <div className="tag-row">
        <Tag type="gray">{kindLabel(data.kind)}</Tag>
        {generation > 0 && <Tag type="gray">{mw(generation)}</Tag>}
        <ModeTag defaultMode={data.mode_code} />
      </div>

      <Tabs selectedIndex={tab ?? (run ? 1 : 0)} onChange={({ selectedIndex }) => setTab(selectedIndex)}>
        <TabList aria-label="Site sections">
          <Tab>Site details</Tab>
          <Tab disabled={!run}>Live overview</Tab>
          <Tab disabled={!run}>AI Actions</Tab>
          <Tab disabled={!run}>Maintenance</Tab>
          <Tab disabled={!run}>Activity log</Tab>
        </TabList>
        <TabPanels>
          <TabPanel>
            <Table aria-label="Site assets">
              <TableHead>
                <TableRow>
                  <TableHeader>Asset</TableHeader>
                  <TableHeader>Type</TableHeader>
                  <TableHeader>Capacity</TableHeader>
                  <TableHeader>Details</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.assets.map((asset) => (
                  <TableRow key={asset.code}>
                    <TableCell>
                      {asset.name}
                      <div className="stat-label">{asset.code}</div>
                    </TableCell>
                    <TableCell>{kindLabel(asset.kind)}</TableCell>
                    <TableCell>{mw(asset.capacity_mw)}</TableCell>
                    <TableCell>{assetSummary(asset)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <DataSources site={data.code} />
          </TabPanel>
          <TabPanel>
            {run && (
              <LiveOverview
                run={run}
                siteCode={data.code}
                generationSeries={data.assets.some((a) => a.kind === 'solar') ? 'solar' : 'wind'}
              />
            )}
          </TabPanel>
          <TabPanel>{run && <SiteActions run={run} site={data.code} />}</TabPanel>
          <TabPanel>{run && <SiteMaintenance run={run} site={data.code} />}</TabPanel>
          <TabPanel>{run && <SiteActivity run={run} site={data.code} />}</TabPanel>
        </TabPanels>
      </Tabs>
    </>
  )
}

/** The site's connected data: simulated telemetry, plus any imports and APIs (a mock). */
function DataSources({ site }: { site: string }) {
  const queryClient = useQueryClient()
  const { data } = useQuery({ queryKey: ['sources', site], queryFn: () => siteApi.sources(site) })
  const remove = useMutation({
    mutationFn: (id: number) => siteApi.removeSource(site, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sources', site] }),
  })
  return (
    <div className="live">
      <div className="page-head">
        <h2 className="section-title">Data sources</h2>
        <Button kind="tertiary" size="md" as={Link} to={`/sites/${site}/data`}>Connect data source</Button>
      </div>
      <div className="action-card__head">
        <Tag size="sm" type="green">Live</Tag>
        <span>Simulated telemetry, every 15 minutes: what BOB plans on</span>
      </div>
      {data?.map((s) => (
        <div key={s.id} className="action-card__head">
          <Tag size="sm" type="gray">{s.kind === 'csv' ? 'Imported CSV' : `API, every ${s.refresh_min} min`}</Tag>
          <span>{s.name}{s.rows !== null && ` · ${s.rows} rows`} · {s.columns.length} columns · by {s.created_by}</span>
          <Button kind="ghost" size="sm" onClick={() => remove.mutate(s.id)}>Remove</Button>
        </div>
      ))}
    </div>
  )
}
