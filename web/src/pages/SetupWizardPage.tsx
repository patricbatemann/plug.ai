import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Checkbox, InlineNotification, NumberInput, SkeletonText, Stack, TextInput } from '@carbon/react'
import { Bot, Checkmark, CheckmarkFilled, Locked } from '@carbon/icons-react'
import { configApi, portfolioApi, type ConfigOut, type ConfigValues } from '../api/client'
import { Chat } from '../runs/AskBob'
import { useCurrentRun } from '../runs/useCurrentRun'
import { AUTONOMY, configKindLabel, limitsSummary, modeLabel } from '../format'

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
  const portfolio = useQuery({ queryKey: ['portfolio'], queryFn: portfolioApi.get })
  const site = useQuery({ queryKey: ['site', code], queryFn: () => portfolioApi.site(code) })
  const { data: run } = useCurrentRun()
  const mode = run?.mode ?? portfolio.data?.mode_code ?? 'balanced'
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

  const stepCard = (title: string, children: ReactNode) => (
    <div className="chat__bot">
      <span className="icon-box icon-box--brand"><Bot size={16} /></span>
      <section className="panel setup__card">
        <h2 className="setup__question">{title}</h2>
        {children}
      </section>
    </div>
  )

  return (
    <>
      <div className="review-bar">
        <span className="bob-mark"><Bot size={20} /></span>
        <h1>BOB agent setup</h1>
        <span className="chip">{site.data?.name ?? code}</span>
        <span className={`badge badge--${step === 3 ? 'green' : 'blue'}`}>{step === 3 ? 'Ready to activate' : 'Setup in progress'}</span>
        <Button kind="tertiary" size="sm" className="review-bar__end" onClick={() => navigate(`/sites/${code}/bob`)}>Save and exit</Button>
      </div>
      <div className="steps">
        <ol>
          {STEPS.map((label, i) => (
            <li key={label} className={i < step ? 'steps__done' : i === step ? 'steps__now' : undefined}>
              <span className="steps__num">{i < step ? <Checkmark size={12} /> : i + 1}</span>{label}
            </li>
          ))}
        </ol>
        <p className="cell-sub">
          {chosen ? `${chosen.name}${kind ? ` · ${configKindLabel(kind)}` : ''}` : 'Choose what BOB may do'} · {configs.data.length} configured actions at this site
        </p>
      </div>

      <div className="setup">
        <div className="setup__main">
          {step === 0 && stepCard('Which asset should BOB act on, and what may it do?', (
            <>
              <div className="choice-grid">
                {options.data.assets.filter((a) => a.actions.length).map((a) => (
                  <button key={a.code} type="button" className="choice" aria-pressed={asset === a.code}
                    onClick={() => { setAsset(a.code); setKind(''); setValues(null) }}>
                    <strong>{a.name}</strong>
                    <span className="cell-sub">{a.capacity_mw} MW · {a.actions.length} possible actions</span>
                  </button>
                ))}
              </div>
              {chosen && (
                <div className="choice-grid">
                  {chosen.actions.map((k) => {
                    const done = configs.data.some((c) => c.asset === chosen.code && c.kind === k)
                    return (
                      <button key={k} type="button" className="choice" aria-pressed={kind === k} onClick={() => { setKind(k); setValues(null) }}>
                        <span className="choice__title"><strong>{configKindLabel(k)}</strong>{done && <span className="badge badge--green">Configured</span>}</span>
                        <span className="cell-sub">{chosen.name}</span>
                      </button>
                    )
                  })}
                </div>
              )}
              <div className="wizard__buttons">
                <Button className="btn-tall" disabled={!asset || !kind} onClick={() => setStep(1)}>
                  {kind ? `Configure ${configKindLabel(kind).toLowerCase()}` : 'Configure'}
                </Button>
              </div>
            </>
          ))}

          {step === 1 && stepCard(`Configure ${configKindLabel(kind).toLowerCase()} on ${chosen?.name ?? asset}`, (
            <Stack gap={6}>
              <TextInput id="name" labelText="Name" value={form.name} onChange={(e) => edit({ name: e.target.value })} />
              <fieldset className="choice-list">
                <legend>How should BOB carry out this action?</legend>
                {Object.entries(AUTONOMY).map(([key, a]) => (
                  <label key={key} className="choice-row">
                    <input type="radio" name="autonomy" value={key} checked={form.autonomy === key}
                      onChange={() => edit({ autonomy: key as ConfigValues['autonomy'] })} />
                    <span><strong>{a.label}</strong><span className="cell-sub">{a.detail}</span></span>
                  </label>
                ))}
              </fieldset>
              <div className="form-grid">
                {(LIMIT_FIELDS[kind] ?? []).map(([key, label]) => (
                  <NumberInput key={key} id={key} label={label} min={0} value={form.limits[key] ?? 0} hideSteppers
                    onChange={(_, { value }) => edit({ limits: { ...form.limits, [key]: Number(value) } })} />
                ))}
                <NumberInput id="response" label="Approver must respond within (minutes)" min={1} max={60} hideSteppers
                  value={form.approval.response_min ?? 10}
                  onChange={(_, { value }) => edit({ approval: { ...form.approval, response_min: Number(value) } })} />
              </div>
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
              <p className="cell-sub">
                What BOB prioritises comes from the portfolio mode: {modeLabel(mode)} ({run?.mode_by === 'bob'
                  ? 'set by BOB for the situation' : run?.mode_by === 'rule' ? 'set by rule for the situation'
                  : 'operator default'}). Change the default in Settings.
              </p>
              <div className="policy-note">
                <strong><Locked size={14} /> Protected limits (organisation, cannot be changed here)</strong>
                {protectedLimits.battery_soc_floor_pct !== undefined && (
                  <p>Battery reserve never below {protectedLimits.battery_soc_floor_pct} %</p>
                )}
                {protectedLimits.approval_above_mw !== undefined && (
                  <p>Any action above {protectedLimits.approval_above_mw} MW needs approval</p>
                )}
              </div>
              {save.error && (
                <InlineNotification kind="error" lowContrast hideCloseButton
                  title={save.error.message.startsWith('Protected boundary') ? 'Safety rule blocked this setting' : 'Could not save'}
                  subtitle={save.error.message} />
              )}
              <div className="wizard__buttons">
                <Button kind="secondary" className="btn-tall" onClick={() => setStep(0)}>Back</Button>
                <Button className="btn-tall" onClick={() => save.mutate()}>Save draft and test</Button>
              </div>
            </Stack>
          ))}

          {step === 2 && draft && stepCard('How will BOB respond? Tests against the live simulation', (
            <>
              <p className="cell-sub">Each test plans the current block with this draft in force. Nothing is sent to any asset.</p>
              <div className="scenarios">
                {Object.entries(draft.tests).map(([key, t]) => (
                  <div key={key} className="scenario">
                    <span className="scenario__title"><strong>{t.label}</strong>
                      <span className={`badge badge--${t.passed ? 'green' : 'red'}`}>{t.passed ? 'Passed' : 'Failed'}</span>
                    </span>
                    <span className="cell-sub">{t.detail}</span>
                  </div>
                ))}
              </div>
              {allPassed && (
                <div className="callout callout--success">
                  <CheckmarkFilled size={20} />
                  <div><strong>BOB can carry out this action within the configured limits</strong>
                    <p>All {Object.keys(draft.tests).length} required scenarios passed. Review the changes, then activate.</p></div>
                </div>
              )}
              {test.error && <InlineNotification kind="error" lowContrast hideCloseButton title="Could not test" subtitle={test.error.message} />}
              <div className="wizard__buttons">
                <Button kind="secondary" className="btn-tall" onClick={() => setStep(1)}>Back</Button>
                <Button kind="tertiary" className="btn-tall" onClick={() => test.mutate()} disabled={test.isPending}>
                  {test.isPending ? 'Testing…' : 'Run tests'}
                </Button>
                <Button className="btn-tall" disabled={!allPassed} onClick={() => setStep(3)}>Review changes</Button>
              </div>
            </>
          ))}

          {step === 3 && draft && stepCard(`Review and activate version ${draft.version}`, (
            <>
              {[
                ['How BOB acts', draft.active ? AUTONOMY[draft.active.autonomy].label : '—', AUTONOMY[draft.autonomy].label],
                ['Limits', draft.active ? limitsSummary(draft.active.limits).join('; ') : '—', limitsSummary(draft.limits).join('; ')],
                ['Approver response', draft.active ? `${draft.active.approval.response_min ?? 10} min` : '—', `${draft.approval.response_min ?? 10} min`],
                ['Watch', draft.active?.watch.map((w) => `${w.metric.replace(/_/g, ' ')} ${w.value}`).join(', ') || '—',
                  draft.watch.map((w) => `${w.metric.replace(/_/g, ' ')} ${w.value}`).join(', ') || '—'],
              ].map(([setting, before, after]) => (
                <div key={setting} className="compare">
                  <strong>{setting}</strong>
                  <div className="compare__row"><span>In force now</span>{before}</div>
                  <div className={`compare__row${before === after ? '' : ' compare__row--new'}`}><span>After activation</span>{after}</div>
                </div>
              ))}
              {activate.error && <InlineNotification kind="error" lowContrast hideCloseButton title="Could not activate" subtitle={activate.error.message} />}
              <div className="wizard__buttons">
                <Button kind="secondary" className="btn-tall" onClick={() => setStep(2)}>Back</Button>
                <Button className="btn-tall" onClick={() => activate.mutate()}>Activate version {draft.version}</Button>
              </div>
            </>
          ))}

          <div className="setup__chat">
            <p className="cell-sub">
              Or tell BOB what you want, for example “automatic up to 8 MW, keep 40 % in reserve”. It fills a draft and tests it;
              you review and activate here.
            </p>
            <Chat />
          </div>
        </div>

        <aside className="review__side">
          <div className="review__side-title setup__side-title">
            Configured actions
            <Button kind="tertiary" size="sm" onClick={() => navigate(`/sites/${code}/bob/setup`)}>Add action</Button>
          </div>
          <div className="review__side-body">
            {configs.data.length === 0 && <p className="cell-sub">Nothing configured yet.</p>}
            {configs.data.map((c) => (
              <div key={c.id} className={`panel side-config${c.asset === asset && c.kind === kind ? ' side-config--now' : ''}`}>
                <div className="chat-card__head">
                  <strong>{c.name}</strong>
                  <span className={`badge badge--${!c.current ? 'gray' : c.status === 'active' ? 'green' : 'amber'}`}>
                    {!c.current ? 'Draft' : c.status === 'active' ? 'Active' : 'Paused'}
                  </span>
                </div>
                <p className="cell-sub">{AUTONOMY[c.autonomy].label} · version {c.version}</p>
                <Link className="text-link" to={`/sites/${code}/bob/setup?asset=${c.asset}&kind=${c.kind}`}>
                  {c.current ? 'Edit' : 'Continue setup'}
                </Link>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </>
  )
}
