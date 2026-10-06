import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, InlineNotification, NumberInput, PasswordInput, TextInput } from '@carbon/react'
import { CloudUpload, Document, Plug, Upload } from '@carbon/icons-react'
import { fileUpload, portfolioApi, siteApi, type CsvCheck } from '../api/client'
import { useCurrentRun } from '../runs/useCurrentRun'

const TYPE_TONE = { DateTime: 'blue', Number: 'green', Integer: 'purple', String: 'gray' } as const

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

  const csvReady = file && preview?.from === file.filename

  return (
    <>
      <div className="site-head site-head--roomy">
        <nav className="crumbs crumbs--links" aria-label="Breadcrumb">
          <Link to="/portfolio">Sites</Link><span>/</span><Link to={`/sites/${code}`}>{site.data?.name ?? 'Site'}</Link><span>/</span><span>Connect data</span>
        </nav>
        <h1 className="page-title">Connect data source</h1>
        <p className="site-head__meta site-head__meta--last">
          Import telemetry history from a CSV, or connect a live system API. This is a simulation: imports are stored
          for the site, the API is answered by the simulator, and BOB plans on simulated telemetry.
        </p>
      </div>

      <div className="stack">
        <div className="two-col">
          <section className="panel panel--padded source">
            <div className="source__head">
              <span className="icon-box icon-box--info"><Upload size={20} /></span>
              <div><h2 className="panel__title panel__title--small">Upload CSV</h2><p className="cell-sub">Import telemetry history from a file</p></div>
            </div>
            <input ref={input} type="file" accept=".csv,text/csv" hidden
              onChange={(e) => { if (e.target.files?.[0]) pick(e.target.files[0]); e.target.value = '' }} />
            <div className="dropzone" onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files[0]) pick(e.dataTransfer.files[0]) }}>
              <CloudUpload size={24} />
              <span>Drag and drop your CSV file here</span>
              <button type="button" className="text-link" onClick={() => input.current?.click()}>Browse files</button>
            </div>
            <p className="cell-sub">
              Columns: timestamp, asset, power_mw (required); available_mw, soc_pct, voltage_v, cell_temp_c, status,
              frequency_hz (optional). One row per asset and time.
            </p>
            {csvReady && (
              <div className="file-row">
                <Document size={20} />
                <div><strong>{file.filename}</strong><div className="cell-sub">{preview.check.rows} rows · {preview.check.columns.length} columns</div></div>
                <span className={`badge badge--${preview.check.problems.length ? 'red' : 'green'}`}>
                  {preview.check.problems.length ? 'Cannot import' : 'Detected'}
                </span>
                <button type="button" className="text-link" onClick={() => { setFile(null); setPreview(null) }}>Remove</button>
              </div>
            )}
            {run && (
              <button type="button" className="text-link" onClick={() => siteApi.downloadTelemetry(run.id, code)}>
                Download this run&apos;s telemetry as a sample
              </button>
            )}
          </section>

          <section className="panel panel--padded source">
            <div className="source__head">
              <span className="icon-box"><Plug size={20} /></span>
              <div><h2 className="panel__title panel__title--small">Connect API</h2><p className="cell-sub">Live data feed that updates automatically</p></div>
            </div>
            <TextInput id="endpoint" labelText="API endpoint URL" placeholder="https://scada.example.com/v1/telemetry"
              value={api.endpoint} onChange={(e) => setApi({ ...api, endpoint: e.target.value })} />
            <PasswordInput id="api-key" labelText="API key" helperText="Not stored in this demo" />
            <div className="source__row">
              <NumberInput id="refresh" label="Refresh every (minutes)" min={1} max={60} value={api.refresh_min}
                onChange={(_, { value }) => setApi({ ...api, refresh_min: Number(value) })} />
              <Button kind="tertiary" className="btn-tall" disabled={!api.endpoint || test.isPending} onClick={() => test.mutate()}>
                {test.isPending ? 'Testing…' : 'Test connection'}
              </Button>
            </div>
            <div>
              <Button className="btn-tall" disabled={!api.endpoint || preview?.from !== api.endpoint || connect.isPending}
                onClick={() => connect.mutate()}>Connect</Button>
            </div>
            {connect.isSuccess && <InlineNotification kind="success" lowContrast hideCloseButton title="Connected" />}
          </section>
        </div>

        {error && <InlineNotification kind="error" lowContrast hideCloseButton title={error.message} />}
        {preview && (
          <section className="panel">
            <div className="panel__head panel--padded preview__head">
              <div>
                <h2 className="panel__title panel__title--small">Data preview</h2>
                <p className="cell-sub">{preview.check.rows} rows · {preview.check.columns.length} columns detected</p>
              </div>
              <span className="cell-sub">Showing the first {preview.check.preview.length} rows</span>
            </div>
            {preview.check.problems.map((problem) => (
              <InlineNotification key={problem} kind="error" lowContrast hideCloseButton title={problem} />
            ))}
            <div className="table-scroll">
              <table className="ftable ftable--compact">
                <thead>
                  <tr>
                    {preview.check.columns.map((c) => (
                      <th key={c.name}>{c.name}<div><span className={`badge badge--${TYPE_TONE[c.type as keyof typeof TYPE_TONE] ?? 'gray'}`}>{c.type}</span></div></th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.check.preview.map((row, i) => (
                    <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      <div className="action-bar">
        <Link to={`/sites/${code}`} className="text-link">Cancel</Link>
        {importCsv.isSuccess && <span className="badge badge--green">Imported</span>}
        <Button className="btn-tall" disabled={!csvReady || preview.check.problems.length > 0 || importCsv.isPending}
          onClick={() => importCsv.mutate()}>Import data</Button>
      </div>
    </>
  )
}
