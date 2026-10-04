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

/** Run a control action and refresh everything that depends on the run's clock. */
export function useRunAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (action: () => Promise<RunState>) => action(),
    onSuccess: (state) => {
      queryClient.setQueryData(['run'], state)
      queryClient.invalidateQueries({ queryKey: ['live'] })
    },
  })
}
