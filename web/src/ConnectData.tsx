import { useRef, useState } from "react"
import { fileUpload, siteApi } from "./api/client"
import { SITE } from "./data"
import { useSite } from "./site"

interface ConnectDataProps {
  onBack: () => void
}
interface Dataset {
  headers: string[]
  types: string[]
  rows: string[][]
  total: number
  name: string
  kind: "CSV" | "API"
  upload?: { filename: string; data: string }
  problems: string[]
}

const reason = (failure: unknown, fallback: string) => (failure instanceof Error ? failure.message : fallback)
const input =
  "min-h-11 w-full min-w-0 border border-[#e0e0e0] bg-white px-3 text-sm focus:outline-2 focus:outline-[#0f62fe]"
const button =
  "min-h-11 border border-[#e0e0e0] px-4 text-sm font-semibold hover:bg-[#f4f4f4] disabled:cursor-not-allowed disabled:opacity-50"

export default function ConnectData({ onBack }: ConnectDataProps) {
  const { siteName } = useSite()
  const [dataset, setDataset] = useState<Dataset | null>(null)
  const [phase, setPhase] = useState<"source" | "success">("source")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [endpoint, setEndpoint] = useState("")
  const [key, setKey] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [interval, setInterval] = useState("5")
  const [detected, setDetected] = useState(true)
  const [page, setPage] = useState(1)
  const fileInput = useRef<HTMLInputElement>(null)
  const run = async (step: () => Promise<void>, fallback: string) => {
    setError("")
    setBusy(true)
    try {
      await step()
    } catch (failure) {
      setError(reason(failure, fallback))
    } finally {
      setBusy(false)
    }
  }
  // The server reads the file; nothing is imported until Import Data.
  const load = (file?: File) => file && run(async () => {
    if (fileInput.current) fileInput.current.value = ""
    const upload = await fileUpload(file)
    const check = await siteApi.checkCsv(SITE.id, upload)
    setDataset({
      headers: check.columns.map((c) => c.name), types: check.columns.map((c) => c.type), rows: check.preview,
      total: check.rows, name: file.name, kind: "CSV", upload, problems: check.problems,
    })
    setPage(1)
    if (check.problems.length) setError(check.problems.join("; "))
  }, "Unable to read CSV.")
  // Testing the site's telemetry API also keeps it as the site's live source.
  const testAPI = () => run(async () => {
    const feed = await siteApi.connectFeed(SITE.id, endpoint, key, Number(interval))
    setDataset({
      headers: feed.headers, types: [], rows: feed.rows.map((row) => row.map(String)), total: feed.rows.length,
      name: new URL(endpoint).hostname, kind: "API", problems: [],
    })
    setPage(1)
    setKey("")
  }, "API connection failed.")
  const handleImport = () => run(async () => {
    if (dataset?.upload) await siteApi.importCsv(SITE.id, dataset.upload)
    setPhase("success")
  }, "Data import validation failed.")

  return (
    <div className="flex min-h-screen min-w-0 flex-col bg-[#f4f4f6] text-[#525252] font-['IBM Plex Sans:Regular'] [&_button]:focus-visible:outline-2 [&_button]:focus-visible:outline-offset-2 [&_button]:focus-visible:outline-[#0f62fe]">
      <header className="space-y-4 border-b border-[#e0e0e0] bg-white px-4 py-6 md:px-8 xl:px-12">
        <nav aria-label="Breadcrumb" className="flex flex-wrap gap-2 text-xs">
          <button onClick={onBack} className="text-[#0f62fe]">
            Sites
          </button>
          <span>/</span>
          <button onClick={onBack} className="text-[#0f62fe]">
            {siteName}
          </button>
          <span>/</span>
          <span>Connect data</span>
        </nav>
        <h1 className="text-[32px] font-light text-[#161616]">
          Connect data source
        </h1>
        <p className="text-sm">
          Import data via CSV upload or connect to a live system API
        </p>
      </header>
      <main className="space-y-6 px-4 py-6 md:px-8 xl:px-12">
        {error && (
          <div
            role="alert"
            className="border-l-4 border-[#da1e28] bg-[#fff1f1] p-4 text-sm text-[#da1e28]"
          >
            {error}
            <button
              onClick={() => setError("")}
              className="ml-4 min-h-11 underline"
            >
              Dismiss
            </button>
          </div>
        )}
        {phase === "success" ? (
          <section className="space-y-4 border-l-4 border-[#198038] bg-white p-6">
            <h2 className="text-xl font-semibold text-[#198038]">
              Data source connected
            </h2>
            <p className="text-sm">
              {dataset?.name} · {dataset?.total} rows validated · Required
              fields mapped.
            </p>
            <p className="text-sm">
              {dataset?.kind === "CSV"
                ? "Historical/imported data only — this does not refresh live telemetry."
                : "Live feed connected. It refreshes every block, and BOB now plans on it and acts at this site within its configured limits."}
              {dataset?.kind === "CSV" && " Monitoring only; no BOB control permission granted."}
            </p>
            <button
              onClick={onBack}
              className={`${button} bg-[#0f62fe] text-white`}
            >
              Return to Site details
            </button>
          </section>
        ) : (
          <>
            <div className="grid items-start gap-6 lg:grid-cols-2">
              <section className="space-y-4 border border-[#e0e0e0] bg-white p-4 md:p-6">
                <div className="flex items-center gap-3">
                  <span
                    className="flex size-10 items-center justify-center rounded bg-[#edf5ff] text-xl text-[#0f62fe]"
                    aria-hidden="true"
                  >
                    ↑
                  </span>
                  <div>
                    <h2 className="font-semibold text-[#161616]">Upload CSV</h2>
                    <p className="text-xs">
                      Import static data from a CSV file
                    </p>
                  </div>
                </div>
                <input
                  ref={fileInput}
                  type="file"
                  accept=".csv,text/csv"
                  aria-label="Upload CSV file"
                  className="sr-only"
                  onChange={(event) => void load(event.target.files?.[0])}
                />
                <div
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault()
                    void load(event.dataTransfer.files[0])
                  }}
                  className="flex flex-col items-center gap-2 rounded border border-dashed border-[#0f62fe] px-4 py-8"
                >
                  <span aria-hidden="true" className="text-3xl text-[#8d8d8d]">
                    ↑
                  </span>
                  <p className="text-sm">Drag &amp; drop your CSV file here</p>
                  <button
                    disabled={busy}
                    className="min-h-11 text-sm font-semibold text-[#0f62fe] underline"
                    onClick={() => fileInput.current?.click()}
                  >
                    Browse Files
                  </button>
                </div>
                {dataset?.kind === "CSV" && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-[#e0e0e0] p-3">
                    <div className="min-w-0">
                      <p className="break-all text-sm font-semibold text-[#161616]">
                        {dataset.name}
                      </p>
                      <p className="text-xs text-[#6f6f6f]">
                        {dataset.total} rows · {dataset.headers.length}{" "}
                        columns · Historical/imported data
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-[#defbe6] px-2 py-1 text-xs text-[#198038]">
                        ✓ Detected
                      </span>
                      <button
                        onClick={() => {
                          setDataset(null)
                          setPhase("source")
                        }}
                        className="min-h-11 text-xs text-[#da1e28] underline"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </section>
              <section className="space-y-4 border border-[#e0e0e0] bg-white p-4 md:p-6">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex size-10 items-center justify-center rounded bg-[#f4f4f4] text-xl"
                  >
                    ↗
                  </span>
                  <div>
                    <h2 className="font-semibold text-[#161616]">
                      Connect API
                    </h2>
                    <p className="text-xs">
                      Live data feed that updates automatically
                    </p>
                  </div>
                </div>
                <label className="block space-y-2 text-sm font-semibold">
                  API Endpoint URL
                  <input
                    value={endpoint}
                    onChange={(event) => setEndpoint(event.target.value)}
                    placeholder={`${location.origin}/api/mock/sites/${SITE.id}/telemetry`}
                    type="url"
                    className={input}
                  />
                </label>
                <label className="block space-y-2 text-sm font-semibold">
                  API Key
                  <div className="flex">
                    <input
                      aria-label="API Key"
                      value={key}
                      onChange={(event) => setKey(event.target.value)}
                      autoComplete="off"
                      type={showKey ? "text" : "password"}
                      className={input}
                    />
                    <button
                      aria-label={showKey ? "Hide API key" : "Show API key"}
                      onClick={() => setShowKey(!showKey)}
                      className={button}
                    >
                      {showKey ? "Hide" : "Show"}
                    </button>
                  </div>
                </label>
                <div className="flex flex-wrap items-end gap-4">
                  <label className="min-w-0 flex-1 space-y-2 text-sm font-semibold">
                    Refresh Interval
                    <select
                      value={interval}
                      onChange={(event) => setInterval(event.target.value)}
                      className={input}
                    >
                      <option value="1">Every minute</option>
                      <option value="5">Every 5 minutes</option>
                      <option value="15">Every 15 minutes</option>
                    </select>
                  </label>
                  <button
                    disabled={busy || !endpoint}
                    onClick={() => void testAPI()}
                    className={button}
                  >
                    {busy ? "Validating…" : "Test Connection"}
                  </button>
                </div>
                {dataset?.kind === "API" && (
                  <p role="status" className="text-xs text-[#198038]">
                    Connection response validated — ready to import.
                  </p>
                )}
                <p className="text-xs">
                  Battery execution requires telemetry no older than 2 minutes;
                  a 5-minute refresh is monitoring-only.
                </p>
              </section>
            </div>
            {dataset && (
              <section className="min-w-0 overflow-hidden rounded-[2px] border border-[#e0e0e0] bg-white">
                <div className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <div>
                    <h2 className="font-semibold text-[#161616]">
                      Data Preview
                    </h2>
                    <p className="text-xs text-[#6f6f6f]">
                      {dataset.total} rows · {dataset.headers.length}{" "}
                      columns detected ·{" "}
                      {dataset.kind === "CSV"
                        ? `Historical/imported data, not live · first ${dataset.rows.length} shown`
                        : "Live feed sample"}
                    </p>
                  </div>
                  <label className="flex min-h-11 items-center gap-3 text-xs">
                    <input
                      type="checkbox"
                      checked={detected}
                      onChange={(event) => setDetected(event.target.checked)}
                    />
                    Auto-detect field types
                  </label>
                </div>
                <div
                  role="region"
                  aria-label="Data preview table"
                  tabIndex={0}
                  className="overflow-x-auto"
                >
                  <table className="w-full border-collapse text-left text-xs">
                    <thead className="bg-[#f4f4f4]">
                      <tr>
                        {dataset.headers.map((header, index) => (
                          <th
                            key={header}
                            className="min-w-28 whitespace-nowrap border-b border-[#e0e0e0] px-5 py-3"
                          >
                            <p>{header}</p>
                            {detected && dataset.types[index] && (
                              <span className="mt-1 inline-block rounded bg-[#defbe6] px-1.5 py-0.5 text-[10px] text-[#198038]">
                                {dataset.types[index]}
                              </span>
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {dataset.rows
                        .slice((page - 1) * 10, page * 10)
                        .map((row, index) => (
                          <tr
                            key={index}
                            className="border-b border-[#e0e0e0] hover:bg-[#f9fafb]"
                          >
                            {row.map((cell, column) => (
                              <td
                                key={column}
                                className="whitespace-nowrap px-5 py-3"
                              >
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 bg-[#f9fafb] px-5 py-3 text-xs">
                  <span>
                    Showing {(page - 1) * 10 + 1}-
                    {Math.min(page * 10, dataset.rows.length)} of{" "}
                    {dataset.rows.length} rows
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      className={button}
                      disabled={page === 1}
                      onClick={() => setPage(page - 1)}
                      aria-label="Previous page"
                    >
                      ‹
                    </button>
                    <span>
                      {page} / {Math.ceil(dataset.rows.length / 10)}
                    </span>
                    <button
                      className={button}
                      disabled={page * 10 >= dataset.rows.length}
                      onClick={() => setPage(page + 1)}
                      aria-label="Next page"
                    >
                      ›
                    </button>
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </main>
      {phase !== "success" && (
        <footer className="sticky bottom-0 mt-auto flex flex-wrap justify-between gap-3 border-t border-[#e0e0e0] bg-white px-4 py-4 md:px-8 xl:px-12">
          <button
            onClick={onBack}
            className={button}
          >
            Cancel
          </button>
          <button
            disabled={!dataset || busy || dataset.problems.length > 0}
            onClick={() => void handleImport()}
            className={`${button} border-[#0f62fe] bg-[#0f62fe] text-white hover:bg-[#0043ce]`}
          >
            Import Data
          </button>
        </footer>
      )}
    </div>
  )
}
