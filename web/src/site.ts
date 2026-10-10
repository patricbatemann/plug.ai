import { useQuery, useQueryClient } from '@tanstack/react-query'
import { configApi, portfolioApi, runApi, siteApi } from './api/client'
import { SITE } from './data'
import { useCurrentRun } from './runs/useCurrentRun'

/** The site in view as the live run sees it: readings, approvals waiting on a person, its log and configs. */
export function useSite() {
  const run = useCurrentRun().data
  const enabled = !!run && run.block >= 0
  const key = [run?.id, run?.block, SITE.id]
  const live = useQuery({
    queryKey: ['site-live', ...key],
    queryFn: () => runApi.siteLive(run!.id, SITE.id),
    enabled,
  }).data
  const approvals = useQuery({
    queryKey: ['actions', ...key, 'awaiting'],
    queryFn: () => runApi.actions(run!.id, { site: SITE.id, status: ['awaiting_approval'] }),
    enabled,
  }).data ?? []
  const activity = useQuery({
    queryKey: ['activity', ...key],
    queryFn: () => siteApi.activity(run!.id, SITE.id, []),
    enabled,
  }).data ?? []
  const configs = useQuery({ queryKey: ['configs', SITE.id], queryFn: () => configApi.list(SITE.id) }).data ?? []
  const portfolio = useQuery({ queryKey: ['portfolio'], queryFn: portfolioApi.get }).data
  const battery = live?.batteries[0]
  const discharge = configs.find((c) => c.kind === 'battery_discharge' && c.asset === battery?.code)
  return {
    run,
    live,
    approvals,
    activity,
    configs,
    battery,
    reservePct: discharge?.limits.reserve_pct ?? null,
    floorPct: portfolio?.protected.battery_soc_floor_pct ?? null,
    bobActive: configs.some((c) => c.status === 'active'),
  }
}

/** Pause or resume every action configuration at the site: BOB's on/off switch for it. */
export function useSetBobActive() {
  const queryClient = useQueryClient()
  return async (active: boolean) => {
    const configs = await configApi.list(SITE.id)
    const target = active ? 'paused' : 'active'
    await Promise.all(configs.filter((c) => c.status === target).map((c) => configApi.setStatus(c.id, active ? 'active' : 'paused')))
    await queryClient.invalidateQueries({ queryKey: ['configs', SITE.id] })
  }
}
