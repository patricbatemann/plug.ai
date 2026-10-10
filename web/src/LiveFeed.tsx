import { useEffect, useState } from "react"
import { runApi, type SiteLive } from "./api/client"
import { batteryState, mw, simTime } from "./format"

const SITE = "KUP-SOLAR-001"
const POLL_MS = 5000 // a block settles every 30 s at the demo speed

/** The site's telemetry feed as BOB receives it, and what BOB does at the site this block. */
export default function LiveFeed({ onConnect }: { onConnect: () => void }) {
  const [live, setLive] = useState<SiteLive | null>(null)
  const [error, setError] = useState("")
  useEffect(() => {
    let stopped = false
    const load = async () => {
      try {
        const run = await runApi.current()
        const data = await runApi.siteLive(run.id, SITE)
        if (!stopped) {
          setLive(data)
          setError("")
        }
      } catch (reason) {
        if (!stopped) setError(reason instanceof Error ? reason.message : "The feed is unavailable.")
      }
    }
    load()
    const timer = window.setInterval(load, POLL_MS)
    return () => {
      stopped = true
      window.clearInterval(timer)
    }
  }, [])

  const readings = live
    ? [
        { label: "Irradiance", value: `${live.weather.irradiance_wm2} W/m²` },
        { label: "Wind", value: `${live.weather.wind_ms} m/s` },
        { label: "Ambient", value: `${live.weather.temperature_c} °C` },
        { label: "Frequency", value: `${live.weather.frequency_hz} Hz` },
        ...(live.generation
          ? [{ label: "Generation", value: mw(live.generation.actual_mw) }]
          : []),
        ...live.batteries.map((b) => ({
          label: b.name,
          value: `${b.soc_pct}% · ${batteryState(b.mw, b.available)}`,
        })),
      ]
    : []

  return (
    <section className="bg-white border-b border-[#e0e0e0] flex flex-col gap-3 px-4 md:px-6 py-3">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          <p className="font-semibold text-[#161616] text-[14px]">Live data feed</p>
          {live && (
            <span
              className={`${live.connected ? "bg-[#defbe6] border-[#a7f0ba] text-[#198038]" : "bg-[#f4f4f4] border-[#e0e0e0] text-[#525252]"} border px-2 py-0.5 rounded-[2px] text-[12px] font-semibold`}
            >
              {live.connected ? "Connected" : "Not connected"}
            </span>
          )}
        </div>
        {live && (
          <p className="text-[#525252] text-[12px]">
            Readings to <span className="font-mono text-[#161616]">{simTime(live.as_of)}</span> · refreshes every block
          </p>
        )}
      </div>
      {error && <p className="text-[#da1e28] text-[13px]">{error}</p>}
      {live && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {readings.map((r) => (
              <div key={r.label} className="flex flex-col gap-0.5 min-w-0">
                <p className="text-[#8d8d8d] text-[11px]">{r.label}</p>
                <p className="font-mono font-semibold text-[#161616] text-[13px]">{r.value}</p>
              </div>
            ))}
          </div>
          {live.connected ? (
            <div className="flex flex-col gap-1">
              <p className="text-[#8a3ffc] text-[13px] font-semibold">
                BOB this block: {live.bob_now.length ? live.bob_now.join("; ") : "holding, no change at this site"}.
              </p>
              {live.replanned && (
                <p className="text-[#525252] text-[12px]">
                  Last re-plan on news, <span className="font-mono">{live.replanned}</span>
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap gap-3 items-center">
              <p className="text-[#525252] text-[13px]">
                BOB is only watching this site. Connect its telemetry API to let BOB act on it.
              </p>
              <button onClick={onConnect} className="bg-[#0f62fe] hover:bg-[#0043ce] px-3 py-1.5 rounded-[2px] text-white text-[13px] font-semibold">
                Connect data
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
