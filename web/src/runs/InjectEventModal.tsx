import { useState } from 'react'
import { Modal, NumberInput, Select, SelectItem, Stack } from '@carbon/react'
import type { Portfolio } from '../api/client'

interface Field {
  key: string
  label: string
  value?: number
  options?: 'nodes' | 'lines' | 'bess' | 'consumer'
  scale?: number // sent value = entered value × scale
  list?: boolean // sent as a one-item list
}

export const EVENT_FORMS: Record<string, { title: string; fields: Field[] }> = {
  cloud_bank: {
    title: 'Cloud bank',
    fields: [
      { key: 'node', label: 'Corridor', options: 'nodes' },
      { key: 'depth', label: 'Solar output reduction (%)', value: 30, scale: 0.01 },
      { key: 'minutes', label: 'Duration (minutes)', value: 60 },
    ],
  },
  wind_ramp: {
    title: 'Wind ramp',
    fields: [
      { key: 'node', label: 'Corridor', options: 'nodes' },
      { key: 'delta_ms', label: 'Wind speed change (m/s)', value: 4 },
      { key: 'minutes', label: 'Duration (minutes)', value: 60 },
    ],
  },
  storm: {
    title: 'Storm',
    fields: [
      { key: 'node', label: 'Corridor', options: 'nodes' },
      { key: 'minutes', label: 'Duration (minutes)', value: 180 },
    ],
  },
  price_spike: {
    title: 'Price spike',
    fields: [
      { key: 'from_hh', label: 'From hour', value: 18 },
      { key: 'to_hh', label: 'To hour', value: 22 },
      { key: 'mult', label: 'Price multiplier', value: 1.5 },
    ],
  },
  bess_trip: {
    title: 'Battery trip',
    fields: [
      { key: 'asset', label: 'Battery', options: 'bess' },
      { key: 'minutes', label: 'Duration (minutes)', value: 240 },
    ],
  },
  line_derate: {
    title: 'Line derate',
    fields: [
      { key: 'line', label: 'Corridor line', options: 'lines' },
      { key: 'limit_mw', label: 'New limit (MW)', value: 70 },
      { key: 'minutes', label: 'Duration (minutes)', value: 120 },
    ],
  },
  demand_surge: {
    title: 'Demand surge',
    fields: [
      { key: 'assets', label: 'Consumer', options: 'consumer', list: true },
      { key: 'pct', label: 'Demand change (%)', value: 15 },
      { key: 'minutes', label: 'Duration (minutes)', value: 60 },
    ],
  },
  frequency_dip: {
    title: 'Frequency dip',
    fields: [
      { key: 'hz', label: 'Frequency (Hz)', value: 49.85 },
      { key: 'minutes', label: 'Duration (minutes)', value: 30 },
    ],
  },
  forecast_update: {
    title: 'Forecast update',
    fields: [{ key: 'lookahead_h', label: 'Also reveal events up to (hours ahead)', value: 0 }],
  },
}

interface Props {
  kind: string
  portfolio: Portfolio
  onClose: () => void
  onSubmit: (event: Record<string, unknown>) => void
}

export function InjectEventModal({ kind, portfolio, onClose, onSubmit }: Props) {
  const form = EVENT_FORMS[kind]
  const choices = (options: Field['options']) => {
    if (options === 'nodes') return portfolio.nodes
    if (options === 'lines') return portfolio.lines
    return portfolio.assets.filter((a) => a.kind === options)
  }
  const [values, setValues] = useState<Record<string, number | string>>(() =>
    Object.fromEntries(form.fields.map((f) => [f.key, f.options ? choices(f.options)[0]?.code ?? '' : f.value ?? 0])),
  )

  function submit() {
    const event: Record<string, unknown> = { kind }
    for (const f of form.fields) {
      const value = values[f.key]
      event[f.key] = f.list ? [value] : typeof value === 'number' ? value * (f.scale ?? 1) : value
    }
    onSubmit(event)
  }

  return (
    <Modal
      open
      modalHeading={`Inject event: ${form.title}`}
      primaryButtonText="Inject"
      secondaryButtonText="Cancel"
      onRequestClose={onClose}
      onRequestSubmit={submit}
    >
      <Stack gap={5}>
        {form.fields.map((f) =>
          f.options ? (
            <Select
              key={f.key}
              id={`event-${f.key}`}
              labelText={f.label}
              value={values[f.key]}
              onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
            >
              {choices(f.options).map((c) => (
                <SelectItem key={c.code} value={c.code} text={c.name} />
              ))}
            </Select>
          ) : (
            <NumberInput
              key={f.key}
              id={`event-${f.key}`}
              label={f.label}
              value={values[f.key] as number}
              step={0.01}
              hideSteppers
              onChange={(_, { value }) => setValues({ ...values, [f.key]: Number(value) })}
            />
          ),
        )}
      </Stack>
    </Modal>
  )
}
