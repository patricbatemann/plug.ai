import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { InlineNotification, Modal, Select, SelectItem, Stack } from '@carbon/react'
import { Locked } from '@carbon/icons-react'
import { portfolioApi } from '../api/client'
import { MODES, modeLabel } from '../format'

const MODE_HINT: Record<string, string> = {
  balanced: 'The everyday trade-off between cost, carbon and reserve.',
  economic: 'Lower reserve; chase price spreads.',
  clean: 'Avoid curtailment and imported carbon.',
  resilience: 'Deep reserve and a high battery floor.',
  grid_support: 'Hold reserve and keep to schedule.',
}

/** The operator's default operating mode (change 2), and the organisation's protected limits. */
export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const portfolio = useQuery({ queryKey: ['portfolio'], queryFn: portfolioApi.get })
  const [mode, setMode] = useState<string | null>(null)
  const save = useMutation({
    mutationFn: () => portfolioApi.setMode(mode!),
    onSuccess: () => { queryClient.invalidateQueries(); close() },
  })
  const close = () => { setMode(null); onClose() }
  const current = mode ?? portfolio.data?.mode_code ?? 'balanced'
  const limits = portfolio.data?.protected ?? {}
  return (
    <Modal open={open} modalHeading="Settings" primaryButtonText={save.isPending ? 'Saving…' : 'Save'}
      secondaryButtonText="Cancel" primaryButtonDisabled={!mode || save.isPending}
      onRequestClose={close} onRequestSubmit={() => save.mutate()}>
      <Stack gap={6}>
        <Select id="default-mode" labelText="Default operating mode" value={current}
          helperText={`${MODE_HINT[current]} BOB and the rules may switch mode for a situation, within guard floors; this is the mode they return to.`}
          onChange={(e) => setMode(e.target.value)}>
          {MODES.map((m) => <SelectItem key={m} value={m} text={modeLabel(m)} />)}
        </Select>
        <div className="policy-note">
          <strong><Locked size={14} /> Protected limits (organisation)</strong>
          {limits.battery_soc_floor_pct !== undefined && <p>Battery reserve never below {limits.battery_soc_floor_pct} %</p>}
          {limits.approval_above_mw !== undefined && <p>Any action above {limits.approval_above_mw} MW needs approval</p>}
        </div>
        {save.error && <InlineNotification kind="error" lowContrast hideCloseButton title={save.error.message} />}
      </Stack>
    </Modal>
  )
}
