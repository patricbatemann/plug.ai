import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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

/** Run a control action and refresh everything that depends on the run's clock. */
export function useRunAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (action: () => Promise<RunState>) => action(),
    onSuccess: (state) => {
      queryClient.setQueryData(['run'], state)
      // A clock move, event or new run can change any run view: plans, actions, decisions, totals.
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'run' })
    },
  })
}
