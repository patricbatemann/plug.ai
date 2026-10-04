import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Breadcrumb,
  BreadcrumbItem,
  Button,
  Checkbox,
  InlineNotification,
  NumberInput,
  ProgressIndicator,
  ProgressStep,
  RadioButton,
  RadioButtonGroup,
  Select,
  SelectItem,
  SkeletonText,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
  TextInput,
  Tile,
} from '@carbon/react'
import { Locked } from '@carbon/icons-react'
import { configApi, type ConfigOut, type ConfigValues } from '../api/client'
import { AUTONOMY, configKindLabel, limitsSummary } from '../format'

const LIMIT_FIELDS: Record<string, Array<[string, string]>> = {
  battery_charge: [['max_mw', 'Maximum charge (MW)'], ['auto_max_mw', 'Automatic up to (MW)']],
  battery_discharge: [['max_mw', 'Maximum discharge (MW)'], ['auto_max_mw', 'Automatic up to (MW)'],
    ['reserve_pct', 'Battery reserve to keep (%)']],
  curtail: [['auto_max_mw', 'Automatic curtailment up to (MW)']],
  demand_response: [['max_mw', 'Maximum call (MW)'], ['auto_max_mw', 'Automatic up to (MW)']],
  load_shift: [['max_mw', 'Maximum load moved (MW)']],
  grid_import: [['max_mw', 'Maximum purchase (MW)'], ['auto_max_mw', 'Automatic up to (MW)']],
  grid_export: [['max_mw', 'Maximum sale (MW)'], ['auto_max_mw', 'Automatic up to (MW)'],
    ['min_price_inr_mwh', 'Sell only above (₹/MWh)']],
}
const STEPS = ['Select action', 'Configure', 'Test', 'Activate']

export function SetupWizardPage() {
  const { code = '' } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const options = useQuery({ queryKey: ['config-options', code], queryFn: () => configApi.options(code) })
  const configs = useQuery({ queryKey: ['configs', code], queryFn: () => configApi.list(code) })
  const fromChat = Number(params.get('draft'))  // a draft BOB made in chat opens at its tests
  const [step, setStep] = useState(fromChat ? 2 : params.get('asset') ? 1 : 0)
  const [asset, setAsset] = useState(params.get('asset') ?? '')
  const [kind, setKind] = useState(params.get('kind') ?? '')
  const [values, setValues] = useState<ConfigValues | null>(null)
  const [saved, setSaved] = useState<ConfigOut | null>(null)

  const save = useMutation({
    mutationFn: () => configApi.save(code, { ...values!, asset, kind }),
    onSuccess: (out) => { setSaved(out); setStep(2) },
  })
  const test = useMutation({ mutationFn: () => configApi.test(draft!.id), onSuccess: setSaved })
  const activate = useMutation({
    mutationFn: () => configApi.activate(draft!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configs', code] })
      navigate(`/sites/${code}/bob`)
    },
  })

  if (!options.data || !configs.data) return <SkeletonText paragraph lineCount={6} />
  const chosen = options.data.assets.find((a) => a.code === asset)
  const existing = configs.data.find((c) => c.asset === asset && c.kind === kind)
  const draft = saved ?? (existing && existing.id === fromChat ? existing : null)
  // Start from what is configured now, or from sensible defaults for a new action.
  const form: ConfigValues = values ?? existing ?? {
    name: chosen && kind ? `${configKindLabel(kind)}: ${chosen.name}` : '',
    autonomy: 'approval',
    limits: Object.fromEntries((LIMIT_FIELDS[kind] ?? []).map(([key]) => [key, key === 'reserve_pct' ? 30 : 0])),
    approval: { response_min: 10 },
    watch: [],
  }
  const edit = (change: Partial<ConfigValues>) => setValues({ ...form, ...change })
  const watched = form.watch.find((w) => w.metric === chosen?.watch_metric)
  const allPassed = draft && Object.keys(draft.tests).length > 0 && Object.values(draft.tests).every((t) => t.passed)
  const protectedLimits = options.data.protected

  return (
    <>
      <Breadcrumb noTrailingSlash>
        <BreadcrumbItem><Link to={`/sites/${code}`}>Site</Link></BreadcrumbItem>
        <BreadcrumbItem><Link to={`/sites/${code}/bob`}>Configure BOB</Link></BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>BOB agent setup</BreadcrumbItem>
      </Breadcrumb>
      <h1 className="page-title">BOB agent setup</h1>
      <ProgressIndicator currentIndex={step} spaceEqually className="wizard__steps">
        {STEPS.map((label) => <ProgressStep key={label} label={label} />)}
      </ProgressIndicator>

      {step === 0 && (
        <Tile className="wizard__panel">
          <Stack gap={6}>
            <Select id="asset" labelText="Asset" value={asset} onChange={(e) => { setAsset(e.target.value); setKind(''); setValues(null) }}>
              <SelectItem value="" text="Choose an asset" />
              {options.data.assets.filter((a) => a.actions.length).map((a) => (
                <SelectItem key={a.code} value={a.code} text={`${a.name} (${a.capacity_mw} MW)`} />
              ))}
            </Select>
            {chosen && (
              <Select id="kind" labelText="What should BOB be able to do?" value={kind} onChange={(e) => { setKind(e.target.value); setValues(null) }}>
                <SelectItem value="" text="Choose an action" />
                {chosen.actions.map((k) => <SelectItem key={k} value={k} text={configKindLabel(k)} />)}
              </Select>
            )}
            <div><Button disabled={!asset || !kind} onClick={() => setStep(1)}>Configure</Button></div>
          </Stack>
        </Tile>
      )}

      {step === 1 && (
        <Tile className="wizard__panel">
          <Stack gap={6}>
            <TextInput id="name" labelText="Name" value={form.name} onChange={(e) => edit({ name: e.target.value })} />
            <RadioButtonGroup legendText="How should BOB carry out this action?" name="autonomy" orientation="vertical"
              valueSelected={form.autonomy} onChange={(v) => edit({ autonomy: v as ConfigValues['autonomy'] })}>
              {Object.entries(AUTONOMY).map(([key, a]) => (
                <RadioButton key={key} id={`autonomy-${key}`} value={key} labelText={`${a.label}: ${a.detail}`} />
              ))}
            </RadioButtonGroup>
            {(LIMIT_FIELDS[kind] ?? []).map(([key, label]) => (
              <NumberInput key={key} id={key} label={label} min={0} value={form.limits[key] ?? 0} hideSteppers
                onChange={(_, { value }) => edit({ limits: { ...form.limits, [key]: Number(value) } })} />
            ))}
            <NumberInput id="response" label="Approver must respond within (minutes)" min={1} max={60} hideSteppers
              value={form.approval.response_min ?? 10}
              onChange={(_, { value }) => edit({ approval: { ...form.approval, response_min: Number(value) } })} />
            {chosen?.watch_metric && (
              <Stack gap={3}>
                <Checkbox id="watch" labelText={`Watch: re-plan and flag when ${chosen.watch_label?.toLowerCase()}`}
                  checked={!!watched}
                  onChange={(_, { checked }) => edit({ watch: checked ? [{ metric: chosen.watch_metric!, value: 0 }] : [] })} />
                {watched && (
                  <NumberInput id="watch-value" label={chosen.watch_label ?? ''} hideSteppers value={watched.value}
                    onChange={(_, { value }) => edit({ watch: [{ metric: watched.metric, value: Number(value) }] })} />
                )}
              </Stack>
            )}
            <Tile className="wizard__protected">
              <div className="card-title"><Locked /> Protected limits (organisation, cannot be changed here)</div>
              {protectedLimits.battery_soc_floor_pct !== undefined && (
                <p>Battery reserve never below {protectedLimits.battery_soc_floor_pct} %</p>
              )}
              {protectedLimits.approval_above_mw !== undefined && (
                <p>Any action above {protectedLimits.approval_above_mw} MW needs approval</p>
              )}
            </Tile>
            {save.error && (
              <InlineNotification kind="error" lowContrast hideCloseButton
                title={save.error.message.startsWith('Protected boundary') ? 'Safety rule blocked this setting' : 'Could not save'}
                subtitle={save.error.message} />
            )}
            <div className="wizard__buttons">
              <Button kind="secondary" onClick={() => setStep(0)}>Back</Button>
              <Button onClick={() => save.mutate()}>Save draft and test</Button>
            </div>
          </Stack>
        </Tile>
      )}

      {step === 2 && draft && (
        <Tile className="wizard__panel">
          <Stack gap={5}>
            <p>Tests plan the current block with this draft in force, in the live simulation. Nothing is sent to any asset.</p>
            {Object.entries(draft.tests).map(([key, t]) => (
              <div key={key} className="action-card__head">
                <Tag type={t.passed ? 'green' : 'red'}>{t.passed ? 'Passed' : 'Failed'}</Tag>
                <strong>{t.label}</strong>
                <span className="stat-label">{t.detail}</span>
              </div>
            ))}
            {test.error && <InlineNotification kind="error" lowContrast hideCloseButton title="Could not test" subtitle={test.error.message} />}
            <div className="wizard__buttons">
              <Button kind="secondary" onClick={() => setStep(1)}>Back</Button>
              <Button kind="tertiary" onClick={() => test.mutate()} disabled={test.isPending}>
                {test.isPending ? 'Testing…' : 'Run tests'}
              </Button>
              <Button disabled={!allPassed} onClick={() => setStep(3)}>Review changes</Button>
            </div>
          </Stack>
        </Tile>
      )}

      {step === 3 && draft && (
        <Tile className="wizard__panel">
          <Stack gap={5}>
            <Table aria-label="Change review">
              <TableHead>
                <TableRow><TableHeader>Setting</TableHeader><TableHeader>In force now</TableHeader><TableHeader>After activation</TableHeader></TableRow>
              </TableHead>
              <TableBody>
                {[
                  ['How BOB acts', draft.active ? AUTONOMY[draft.active.autonomy].label : '—', AUTONOMY[draft.autonomy].label],
                  ['Limits', draft.active ? limitsSummary(draft.active.limits).join('; ') : '—', limitsSummary(draft.limits).join('; ')],
                  ['Approver response', draft.active ? `${draft.active.approval.response_min ?? 10} min` : '—', `${draft.approval.response_min ?? 10} min`],
                  ['Watch', draft.active?.watch.map((w) => `${w.metric.replace(/_/g, ' ')} ${w.value}`).join(', ') || '—',
                    draft.watch.map((w) => `${w.metric.replace(/_/g, ' ')} ${w.value}`).join(', ') || '—'],
                ].map(([setting, before, after]) => (
                  <TableRow key={setting}>
                    <TableCell>{setting}</TableCell>
                    <TableCell>{before}</TableCell>
                    <TableCell>{before === after ? after : <strong>{after}</strong>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {activate.error && <InlineNotification kind="error" lowContrast hideCloseButton title="Could not activate" subtitle={activate.error.message} />}
            <div className="wizard__buttons">
              <Button kind="secondary" onClick={() => setStep(2)}>Back</Button>
              <Button onClick={() => activate.mutate()}>Activate version {draft.version}</Button>
            </div>
          </Stack>
        </Tile>
      )}
    </>
  )
}
