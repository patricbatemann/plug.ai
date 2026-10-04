import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Breadcrumb,
  BreadcrumbItem,
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
import { portfolioApi } from '../api/client'
import { assetSummary, kindLabel, modeLabel, mw } from '../format'
import { LiveOverview } from '../runs/LiveOverview'
import { useCurrentRun } from '../runs/useCurrentRun'

export function SitePage() {
  const { code = '' } = useParams()
  const { data, error } = useQuery({ queryKey: ['site', code], queryFn: () => portfolioApi.site(code) })
  const { data: run } = useCurrentRun()
  const [tab, setTab] = useState<number | null>(null)

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
      <h1 className="page-title">
        {data.name} · {data.code}
      </h1>
      <p className="page-meta">
        {data.location} · Commissioned {data.commissioned_on.slice(0, 4)}
      </p>
      <div className="tag-row">
        <Tag type="gray">{kindLabel(data.kind)}</Tag>
        {generation > 0 && <Tag type="gray">{mw(generation)}</Tag>}
        <Tag type="purple">Mode: {modeLabel(data.mode_code)}</Tag>
      </div>

      <Tabs selectedIndex={tab ?? (run ? 1 : 0)} onChange={({ selectedIndex }) => setTab(selectedIndex)}>
        <TabList aria-label="Site sections">
          <Tab>Site details</Tab>
          <Tab disabled={!run}>Live overview</Tab>
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
        </TabPanels>
      </Tabs>
    </>
  )
}
