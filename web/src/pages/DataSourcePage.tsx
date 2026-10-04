import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Breadcrumb, BreadcrumbItem, Button, InlineNotification, NumberInput, Table, TableBody, TableCell, TableHead,
  PasswordInput, TableHeader, TableRow, Tag, TextInput, Tile,
} from '@carbon/react'
import { Plug, Upload } from '@carbon/icons-react'
import { fileUpload, portfolioApi, siteApi, type CsvCheck } from '../api/client'
import { useCurrentRun } from '../runs/useCurrentRun'

const TYPE_TAG = { DateTime: 'blue', Number: 'green', Integer: 'teal', String: 'gray' } as const

/** Connect data source (a mock): import a telemetry CSV, or test an API that the simulator answers. */
export function DataSourcePage() {
  const { code = '' } = useParams()
  const { data: run } = useCurrentRun()
  const queryClient = useQueryClient()
  const site = useQuery({ queryKey: ['site', code], queryFn: () => portfolioApi.site(code) })
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<{ filename: string; data: string } | null>(null)
  const [api, setApi] = useState({ endpoint: '', refresh_min: 5 })
  const [preview, setPreview] = useState<{ from: string; check: CsvCheck } | null>(null)
  const done = () => queryClient.invalidateQueries({ queryKey: ['sources', code] })

  const check = useMutation({
    mutationFn: (f: { filename: string; data: string }) => siteApi.checkCsv(code, f),
    onSuccess: (c, f) => setPreview({ from: f.filename, check: c }),
  })
  const importCsv = useMutation({ mutationFn: () => siteApi.importCsv(code, file!), onSuccess: done })
  const test = useMutation({
    mutationFn: () => siteApi.testApi(code, api),
    onSuccess: (c) => setPreview({ from: api.endpoint, check: c }),
  })
  const connect = useMutation({ mutationFn: () => siteApi.connectApi(code, api), onSuccess: done })
  const pick = async (f: File) => {
    const upload = await fileUpload(f)
    setFile(upload)
    check.mutate(upload)
  }
  const error = check.error ?? importCsv.error ?? test.error ?? connect.error

  return (
    <>
      <Breadcrumb noTrailingSlash>
        <BreadcrumbItem><Link to={`/sites/${code}`}>{site.data?.name ?? 'Site'}</Link></BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>Connect data</BreadcrumbItem>
      </Breadcrumb>
      <h1 className="page-title">Connect data source</h1>
      <p className="page-meta">
        Import telemetry history from a CSV, or connect a live system API. This is a simulation: imports are stored
        for the site, the API is answered by the simulator, and BOB plans on simulated telemetry.
      </p>
      <div className="card-grid card-grid--two">
        <Tile className="simulation__panel">
          <div className="card-title"><Upload /> Upload CSV</div>
          <p className="stat-label">
            Columns: timestamp, asset, power_mw (required); available_mw, soc_pct, voltage_v, cell_temp_c, status,
            frequency_hz (optional). One row per asset and time.
          </p>
          <input ref={input} type="file" accept=".csv,text/csv" hidden
            onChange={(e) => { if (e.target.files?.[0]) pick(e.target.files[0]); e.target.value = '' }} />
          <div className="tag-row">
            <Button kind="tertiary" size="md" onClick={() => input.current?.click()}>Choose a CSV file</Button>
            {run && (
              <Button kind="ghost" size="md" onClick={() => siteApi.downloadTelemetry(run.id, code)}>
                Download this run&apos;s telemetry as a sample
              </Button>
            )}
          </div>
          {file && preview?.from === file.filename && (
            <div className="tag-row">
              <span>{file.filename} · {preview.check.rows} rows · {preview.check.columns.length} columns</span>
              <Tag type={preview.check.problems.length ? 'red' : 'green'}>
                {preview.check.problems.length ? 'Cannot import' : 'Detected'}
              </Tag>
            </div>
          )}
        </Tile>
        <Tile className="simulation__panel">
          <div className="card-title"><Plug /> Connect API</div>
          <TextInput id="endpoint" labelText="API endpoint URL" placeholder="https://scada.example.com/v1/telemetry"
            value={api.endpoint} onChange={(e) => setApi({ ...api, endpoint: e.target.value })} />
          <PasswordInput id="api-key" labelText="API key" helperText="Not stored in this demo" />
          <NumberInput id="refresh" label="Refresh every (minutes)" min={1} max={60} value={api.refresh_min}
            onChange={(_, { value }) => setApi({ ...api, refresh_min: Number(value) })} />
          <div className="tag-row">
            <Button kind="tertiary" size="md" disabled={!api.endpoint || test.isPending} onClick={() => test.mutate()}>
              {test.isPending ? 'Testing…' : 'Test connection'}
            </Button>
            <Button size="md" disabled={!api.endpoint || preview?.from !== api.endpoint || connect.isPending}
              onClick={() => connect.mutate()}>Connect</Button>
          </div>
          {connect.isSuccess && <InlineNotification kind="success" lowContrast hideCloseButton title="Connected" />}
        </Tile>
      </div>
      {error && <InlineNotification kind="error" lowContrast hideCloseButton title={error.message} />}
      {preview && (
        <Tile className="simulation__panel">
          <div className="card-title">Data preview</div>
          <p className="stat-label">
            {preview.check.rows} rows · {preview.check.columns.length} columns detected · showing the first{' '}
            {preview.check.preview.length}
          </p>
          {preview.check.problems.map((p) => (
            <InlineNotification key={p} kind="error" lowContrast hideCloseButton title={p} />
          ))}
          <Table size="sm" aria-label="Data preview">
            <TableHead>
              <TableRow>
                {preview.check.columns.map((c) => (
                  <TableHeader key={c.name}>
                    {c.name} <Tag size="sm" type={TYPE_TAG[c.type as keyof typeof TYPE_TAG]}>{c.type}</Tag>
                  </TableHeader>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {preview.check.preview.map((row, i) => (
                <TableRow key={i}>{row.map((cell, j) => <TableCell key={j}>{cell}</TableCell>)}</TableRow>
              ))}
            </TableBody>
          </Table>
          {file && preview.from === file.filename && (
            <div className="tag-row">
              <Button size="md" disabled={preview.check.problems.length > 0 || importCsv.isPending}
                onClick={() => importCsv.mutate()}>Import data</Button>
              {importCsv.isSuccess && <Tag type="green">Imported</Tag>}
            </div>
          )}
        </Tile>
      )}
    </>
  )
}
