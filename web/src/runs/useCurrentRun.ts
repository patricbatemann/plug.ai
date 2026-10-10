import { useQuery } from '@tanstack/react-query'
import { ApiError, runApi, type RunState } from '../api/client'

export function useCurrentRun() {
  return useQuery({
    queryKey: ['run'],
    queryFn: async () => {
      try {
        return await runApi.current()
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null
        throw error
      }
    },
    refetchInterval: 2000,
  })
}

/** Every site now, for the block in progress; nothing before the run's first block. */
export function useSiteStatuses(run: RunState | null | undefined) {
  return useQuery({
    queryKey: ['sites-status', run?.id, run?.block],
    queryFn: () => runApi.sites(run!.id),
    enabled: !!run && run.block >= 0,
  })
}
