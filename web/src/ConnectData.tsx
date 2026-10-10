import { useEffect, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { siteApi, type DataSource, type Feed, type FeedName } from "./api/client"
import { SITE } from "./data"
import { useSite } from "./site"

interface ConnectDataProps {
  onBack: () => void
}

const REFRESH_MIN = 1
const PAGE = 10

const SOURCES: Array<{ feed: FeedName; kind: DataSource["kind"]; title: string; detail: string; path: string; note: string }> = [
  {
    feed: "telemetry", kind: "api", title: "Site telemetry", path: `/api/mock/sites/${SITE.id}/telemetry`,
    detail: "Each refresh returns the readings of the last three hours, one row per asset for every settled 15-minute block.",
    note: "BOB acts at this site only while its telemetry is connected.",
  },
  {
    feed: "forecast", kind: "forecast", title: "Demand and renewables forecast", path: "/api/mock/portfolio/forecast",
    detail: "The portfolio's demand and renewable availability (P50) for the next 24 hours, one row per block.",
    note: "Kept as this site's forecast source; BOB plans on the same forecasts.",
  },
  {
    feed: "prices", kind: "prices", title: "Market prices", path: "/api/mock/market/prices",
    detail: "The real-time market price forecast (P10, P50, P90) and the day-ahead price for the next 24 hours.",
    note: "Kept as this site's price source; BOB plans on the same prices.",
  },
]

const input =
  "min-h-11 w-full min-w-0 border border-[#e0e0e0] bg-white px-3 text-sm focus:outline-2 focus:outline-[#0f62fe]"
const button =
  "min-h-11 border border-[#e0e0e0] px-4 text-sm font-semibold hover:bg-[#f4f4f4] disabled:cursor-not-allowed disabled:opacity-50"

export default function ConnectData({ onBack }: ConnectDataProps) {
  const { siteName } = useSite()
  const [connected, setConnected] = useState<string[]>([])
  const [done, setDone] = useState(false)
  const sources = useQuery({ queryKey: ["data-sources", SITE.id], queryFn: () => siteApi.sources(SITE.id) }).data

  return (
    <div className="flex min-h-screen min-w-0 flex-col bg-[#f4f4f6] text-[#525252] font-['IBM Plex Sans:Regular'] [&_button]:focus-visible:outline-2 [&_button]:focus-visible:outline-offset-2 [&_button]:focus-visible:outline-[#0f62fe]">
      <header className="space-y-4 border-b border-[#e0e0e0] bg-white px-4 py-6 md:px-8 xl:px-12">
        <nav aria-label="Breadcrumb" className="flex flex-wrap gap-2 text-xs">
          <button onClick={onBack} className="text-[#0f62fe]">Sites</button>
          <span>/</span>
          <button onClick={onBack} className="text-[#0f62fe]">{siteName}</button>
          <span>/</span>
          <span>Connect data</span>
        </nav>
        <h1 className="text-[32px] font-light text-[#161616]">Connect data source</h1>
        <p className="text-sm">The data BOB works from: the site’s telemetry, the portfolio’s forecasts and the market’s prices</p>
      </header>
      <main className="space-y-6 px-4 py-6 md:px-8 xl:px-12">
        {done ? (
          <section className="space-y-4 border-l-4 border-[#198038] bg-white p-6">
            <h2 className="text-xl font-semibold text-[#198038]">Data sources connected</h2>
            <p className="text-sm">{connected.join(" · ")}</p>
            <button onClick={onBack} className={`${button} bg-[#0f62fe] text-white`}>Return to Site details</button>
          </section>
        ) : SOURCES.map((s) => (
          <SourceCard key={s.feed} {...s} saved={sources?.find((x) => x.kind === s.kind)?.name}
            onConnected={(rows) => setConnected((so) => [...so.filter((c) => !c.startsWith(s.title)), `${s.title}: ${rows} rows`])} />
        ))}
      </main>
      {!done && (
        <footer className="sticky bottom-0 mt-auto flex flex-wrap justify-between gap-3 border-t border-[#e0e0e0] bg-white px-4 py-4 md:px-8 xl:px-12">
          <button onClick={onBack} className={button}>Cancel</button>
          <button disabled={!connected.length} onClick={() => setDone(true)}
            className={`${button} border-[#0f62fe] bg-[#0f62fe] text-white hover:bg-[#0043ce]`}>Done</button>
        </footer>
      )}
    </div>
  )
}

/** One feed: its endpoint and key, a connection test that keeps it as the site's source, and what it sends. */
function SourceCard({ feed, title, detail, path, note, saved, onConnected }: {
  feed: FeedName; title: string; detail: string; path: string; note: string; saved?: string; onConnected: (rows: number) => void
}) {
  const queryClient = useQueryClient()
  const [endpoint, setEndpoint] = useState("")
  const [key, setKey] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [data, setData] = useState<Feed | null>(null)
  const [page, setPage] = useState(1)
  useEffect(() => { if (saved) setEndpoint((current) => current || saved) }, [saved])

  const test = async () => {
    setError("")
    setBusy(true)
    try {
      const sent = await siteApi.connectFeed(SITE.id, feed, endpoint, key, REFRESH_MIN)
      setData(sent)
      setPage(1)
      setKey("")
      onConnected(sent.rows.length)
      await queryClient.invalidateQueries({ queryKey: ["data-sources", SITE.id] })
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "API connection failed.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-label={title} className="min-w-0 space-y-4 border border-[#e0e0e0] bg-white p-4 md:p-6">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="flex size-10 items-center justify-center rounded bg-[#f4f4f4] text-xl">↗</span>
        <div>
          <h2 className="font-semibold text-[#161616]">{title}</h2>
          <p className="text-xs">{saved ? "Connected · refreshes every minute" : "Not connected"}</p>
        </div>
      </div>
      <label className="block space-y-2 text-sm font-semibold">
        API Endpoint URL
        <input name={`${feed}-endpoint`} autoComplete="off" type="url" value={endpoint} onChange={(e) => setEndpoint(e.target.value)}
          placeholder={`${location.origin}${path}`} className={input} />
      </label>
      <label className="block space-y-2 text-sm font-semibold">
        API Key
        <div className="flex">
          {/* A password field invites the browser's saved sign-in; this key is not one. */}
          <input aria-label={`${title} API key`} name={`${feed}-api-key`} autoComplete="new-password" type={showKey ? "text" : "password"}
            value={key} onChange={(e) => setKey(e.target.value)} className={input} />
          <button aria-label={showKey ? "Hide API key" : "Show API key"} onClick={() => setShowKey(!showKey)} className={button}>{showKey ? "Hide" : "Show"}</button>
        </div>
      </label>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm">{detail}</p>
        <button disabled={busy || !endpoint} onClick={() => void test()} className={button}>{busy ? "Validating…" : "Test Connection"}</button>
      </div>
      <p className="text-xs">{note}</p>
      {error && <p role="alert" className="border-l-4 border-[#da1e28] bg-[#fff1f1] p-3 text-sm text-[#da1e28]">{error}</p>}
      {data && (
        <div className="min-w-0 overflow-hidden rounded-[2px] border border-[#e0e0e0]">
          <p role="status" className="px-4 py-3 text-xs">Connected. {data.rows.length} rows · {data.headers.length} columns, as the API sends them.</p>
          <div role="region" aria-label={`${title} preview`} tabIndex={0} className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="bg-[#f4f4f4]">
                <tr>{data.headers.map((h) => <th key={h} className="whitespace-nowrap border-b border-[#e0e0e0] px-4 py-3">{h}</th>)}</tr>
              </thead>
              <tbody>
                {data.rows.slice((page - 1) * PAGE, page * PAGE).map((row, i) => (
                  <tr key={i} className="border-b border-[#e0e0e0] hover:bg-[#f9fafb]">
                    {row.map((cell, c) => <td key={c} className="whitespace-nowrap px-4 py-3 font-mono">{String(cell)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#f9fafb] px-4 py-3 text-xs">
            <span>Showing {(page - 1) * PAGE + 1}-{Math.min(page * PAGE, data.rows.length)} of {data.rows.length} rows</span>
            <div className="flex items-center gap-3">
              <button className={button} disabled={page === 1} onClick={() => setPage(page - 1)} aria-label="Previous page">‹</button>
              <span>{page} / {Math.max(1, Math.ceil(data.rows.length / PAGE))}</span>
              <button className={button} disabled={page * PAGE >= data.rows.length} onClick={() => setPage(page + 1)} aria-label="Next page">›</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
