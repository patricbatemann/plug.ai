import { useEffect, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { siteApi } from "./api/client"
import { SITE } from "./data"
import { useSite } from "./site"

interface ConnectDataProps {
  onBack: () => void
}
interface Dataset {
  headers: string[]
  rows: string[][]
  name: string
}

const REFRESH_MIN = 1

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
  const [page, setPage] = useState(1)
  const queryClient = useQueryClient()
  const configured = useQuery({ queryKey: ["data-sources", SITE.id], queryFn: () => siteApi.sources(SITE.id) })
    .data?.find((s) => s.kind === "api")
  useEffect(() => { if (configured) setEndpoint((current) => current || configured.name) }, [configured?.name])
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
  // Testing the site's telemetry API also keeps it as the site's live source.
  const testAPI = () => run(async () => {
    const feed = await siteApi.connectFeed(SITE.id, endpoint, key, REFRESH_MIN)
    setDataset({
      headers: feed.headers, rows: feed.rows.map((row) => row.map(String)), name: new URL(endpoint).hostname,
    })
    setPage(1)
    setKey("")
    await queryClient.invalidateQueries({ queryKey: ["data-sources", SITE.id] })
  }, "API connection failed.")

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
          Connect the site’s live telemetry API
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
              {dataset?.name} · {dataset?.rows.length} rows received.
            </p>
            <p className="text-sm">
              BOB now plans on this feed and acts at this site within its configured limits.
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
                    name="telemetry-endpoint"
                    autoComplete="off"
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
                      name="telemetry-api-key"
                      value={key}
                      onChange={(event) => setKey(event.target.value)}
                      // A password field invites the browser's saved sign-in; this key is not one.
                      autoComplete="new-password"
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
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <p className="text-sm">Refreshes every minute</p>
                  <button
                    disabled={busy || !endpoint}
                    onClick={() => void testAPI()}
                    className={button}
                  >
                    {busy ? "Validating…" : "Test Connection"}
                  </button>
                </div>
                {dataset && (
                  <p role="status" className="text-xs text-[#198038]">
                    Connected. The sample below is what the API sends.
                  </p>
                )}
                <p className="text-xs">
                  Each refresh returns the readings of the last three hours, one
                  row per asset for every settled 15-minute block.
                </p>
              </section>
            {dataset && (
              <section className="min-w-0 overflow-hidden rounded-[2px] border border-[#e0e0e0] bg-white">
                <div className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <div>
                    <h2 className="font-semibold text-[#161616]">
                      Data Preview
                    </h2>
                    <p className="text-xs text-[#6f6f6f]">
                      {dataset.rows.length} rows · {dataset.headers.length}{" "}
                      columns · live feed sample
                    </p>
                  </div>
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
            disabled={!dataset || busy}
            onClick={() => setPhase("success")}
            className={`${button} border-[#0f62fe] bg-[#0f62fe] text-white hover:bg-[#0043ce]`}
          >
            Done
          </button>
        </footer>
      )}
    </div>
  )
}
