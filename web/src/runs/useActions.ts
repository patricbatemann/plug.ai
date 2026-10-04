import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { runApi, type RunState } from '../api/client'

export const OPEN = ['awaiting_approval', 'recommended']

/** BOB's open recommendations: gated actions waiting for a person, and recommend-only ones. */
export function useOpenActions(run: RunState | null | undefined, site?: string) {
  return useQuery({
    queryKey: ['actions', 'open', run?.id, site],
    queryFn: () => runApi.actions(run!.id, { status: OPEN, site, limit: 50 }),
    enabled: !!run,
    refetchInterval: 2000,
  })
}

export function useDecide(run: RunState) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, approve }: { id: number; approve: boolean }) =>
      approve ? runApi.approve(run.id, id) : runApi.decline(run.id, id),
    onSettled: () => queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'run' }),
  })
}
