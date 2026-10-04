# 02 — BOB, the agent

```
 cycle runner (deterministic)                         BOB (Azure OpenAI, tool use)
 ───────────────────────────                          ──────────────────────
 material event? ── no ──► keep active profile, rule selection, templated rationale
       │ yes
       ▼
 open agent turn (budget: 8 tool calls, 20 s) ──────► get_situation()
                                                      set_profile(code, reason)        ── guard floors applied
                                                      add_scenarios([...], reason)     ── library only
                                                      generate_plans()                 ── runs §7 + §9 of 01
                                                      select_plan(id, rationale)       ── bounded discretion check
       ◄──────────────────────────────────────────── end_turn
 budget exceeded / API error / invalid output ──► rule fallback, recorded as `*_by = rule`
       │
       ▼
 validator → policy → execute   (BOB has no execution tool)
```

## What BOB decides, and what it never does

| BOB decides | Deterministic code decides |
| --- | --- |
| Which objective profile fits the situation (above guard floors) | Every number in every plan |
| Which extra stress scenarios to test (from the library) | Feasibility, limits, validation |
| Which plan to run, within 10 % of the minimum worst-case regret | Policy tier of each action, approvals, fallback |
| The operator-facing rationale | Execution and verification |
| How to read an unstructured document into a typed constraint | Whether that constraint applies without a human |
| Answers to operator questions, using tools | — |

If the API is down, the key is missing, or `BOB_ENABLED=false`, every BOB decision has a rule equivalent (01 §6, §9). The UI shows which source made each decision.

## Provider and request settings (Azure OpenAI)

> **As built (P5): Chat Completions, not the Responses API.** The provisioned deployment (`gpt-6-luna`, Foundry project endpoint) answers HTTP 500 to every Responses API call. On Chat Completions it rejects function tools combined with reasoning, so tool turns send `reasoning_effort="none"`; the optimiser does the reasoning that matters, and BOB's choices are bounded by tools. Chat history is stored as Chat Completions messages. The bullets below describe the original Responses design; switch back when the deployment supports it (only `app/agent/llm.py` changes). API-key auth is used (no Entra ID yet). Budgets: cycle turn 20 s and 8 tool calls (`BOB_TIMEOUT_S`, `BOB_MAX_TOOL_CALLS`), chat 60 s. Measured: a cycle turn ≈ 8 s, 4 tool calls, ~6k input tokens (~50 % cached); a chat answer 5–12 s.
>
> **Streaming:** every model call streams (`stream=True`, usage in the last chunk; tool calls reassembled by index). `POST /api/runs/{id}/chat` answers with server-sent events: `status` (a tool started, with a plain label), `delta` (answer text), `done` (the stored conversation with cards). The stream runs in its own session (`get_session_factory`), because FastAPI closes the request's session before a streamed body is sent. If the operator leaves mid-answer, the call log and any draft already made are kept and the exchange is not stored. Proxies in front of the API must not buffer this route (`X-Accel-Buffering: no` is sent).
>
> **When BOB is asked:** live cycles whose trigger is an event or a watch hit, or whose set of material signals differs from the previous cycle's. BOB's mode stands on later scheduled cycles until the material signals change. Otherwise the rules decide, and the decision record shows who chose the mode and the option (`cycle.mode_by`, `cycle.selected_by`, `timings.agent`).
>
> **Not yet built:** separate counting of failure causes in a reliability report (P7 reads `agent_call.error`), the startup probe call, and 429 `retry-after` handling beyond the SDK's single retry.

- **Client:** `openai` Python SDK 2.x against the Azure OpenAI v1 endpoint: `OpenAI(base_url="https://<resource>.openai.azure.com/openai/v1/", api_key=…)`. No `api-version` juggling.
- **Auth:** Microsoft Entra ID via `azure-identity` (`DefaultAzureCredential` + bearer token provider, scope `https://ai.azure.com/.default`) in deployed environments; API key (`AZURE_OPENAI_API_KEY`) for local development only.
- **Deployment:** the `model` argument is the Azure deployment name (env `AZURE_OPENAI_DEPLOYMENT`). It must be a vision-capable reasoning model that supports function calling and structured outputs in the Responses API (current GPT-5.x / GPT-6 family). The exact model is chosen when the resource is provisioned, by regional availability and quota; nothing in code depends on a specific model.
- **API:** Responses API for everything. Recent reasoning models reject function tools combined with reasoning on Chat Completions, so Chat Completions is not used.
- **Reasoning:** `reasoning.effort` set explicitly per purpose: `medium` for cycle turns and extraction, `low` for chat. Allowed values vary by model; the configured value is validated at startup with one probe call.
- **Tool loop:** manual loop (explicit budget, timeout, per-call audit). Function tools declared with `strict: true`; `tool_choice: "auto"`; the system prompt (`developer` role) names the expected tool order. Each request returns `function_call` items; the loop executes them and sends `function_call_output` items with the matching `call_id`.
- **Stateless:** `store=false`. The loop resends the full turn (all output items since the last user message, including reasoning items) instead of `previous_response_id`, so no conversation state lives in Azure and any worker replica can continue a turn. Chat history is persisted in `chat_message` as the raw input/output items.
- **Caching:** Azure applies prompt caching automatically on supported models for long, identical prefixes. Keep the developer prompt and tool definitions byte-stable and first; the volatile situation goes last. Track `usage.input_tokens_details.cached_tokens`.
- **Failures:** 429 (quota) honours `retry-after` within the cycle budget; Azure content-filter blocks, timeouts, schema-invalid output and 5xx all end the turn and fall back to rules. Each cause is counted separately in the reliability report.
- **Data residency:** decided: a Global deployment (prompts may be processed in any Azure region). For a production Indian utility, switch to a regional or data-zone deployment; only the endpoint and deployment name change.
- Each cycle turn is a fresh, short conversation (no growing history). Chat is a separate persisted conversation per run.
- Every call writes an `agent_call` row: purpose, deployment, tokens (input, output, cached, reasoning), latency, tool calls, outcome. This feeds the D2 reliability report and the cost view.

## Cycle tools

All inputs validated with Pydantic; an invalid call returns an error object as its `function_call_output`, with the reason, and BOB may retry within budget.

| Tool | Input | Output (compact JSON, no raw arrays) |
| --- | --- | --- |
| `get_situation` | — | Features (01 §8) with material flags, active events and constraints, current profile, reserve margin, next 8 blocks summary (RE, load, prices, corridor use) |
| `set_profile` | `code`, `reason` | Effective params after guard floors, and which floors were applied |
| `add_scenarios` | `ids[]` from library, `reason` | Final scenario list |
| `generate_plans` | — | Per plan: variant, here-and-now actions, KPIs (cost, carbon, curtailment, wear, deviation, reserve), max regret, per-scenario regret; the rule's choice |
| `select_plan` | `plan_id`, `rationale` (≤ 600 chars, must name the criterion that decided and what it cost) | Accepted, or rejected with the regret tolerance it broke |

## Chat tools (Ask BOB)

Read-only, what-if and configuration drafts; never executes an action or activates a configuration.

| Tool | Purpose |
| --- | --- |
| `get_situation` | As above, for the latest cycle |
| `get_cycle(cycle_id)` | Decision record: profile, plans, regret, selection, actions |
| `get_asset(code)` | Telemetry vs forecast summary, availability, maintenance, battery cycles used |
| `explain_action(action_id)` | Action, tier, policy rule, deadline, status, verification |
| `what_if(changes[])` | Clones the latest state, applies changes (`asset_out`, `line_limit`, `load_pct`, `re_pct`, `price_pct`, `profile`), runs one cycle without executing, returns plan comparison vs current |
| `draft_action_config(site, asset, kind, fields)` | Setup wizard from chat: creates or updates a **draft** `action_config`; returns the validated draft, missing decisions, and any `portfolio.protected` breach (rendered as the "Safety rule blocked action" card with the allowed range) |
| `test_action_config(config_id, scenarios[])` | Runs the wizard's test scenarios in the simulator; returns pass/fail per scenario with the reason |

Chat can draft and test a configuration but never activate it: **Activate** is a button the operator presses after the change review.

## Document extraction (D3 slice)

> **As built (P6).** One `chat.completions.parse` call (`reasoning_effort="low"`), logged as an `extract` agent call. PDFs and text are read locally (pypdf) and sent as text, the same text the quote check uses; images go as `image_url` data URIs. The schema is built per portfolio so `targets` can only be its own node, line and asset codes. Supported kinds: `storm`, `line_derate` (value = new limit; above the base limit it *loosens*), `asset_outage`, `curtailment_order`; `maintenance_notice` and `demand_notice` are extracted but rejected as unsupported. Constraint status: `pending`, `active`, `rejected`, `withdrawn` (an active constraint can be withdrawn; expiry is by its window). Extraction runs inside the upload request (no job queue yet); the run is locked only to apply constraints and re-plan (trigger `document`). Azure's content filter blocks prompt-injection documents outright; that is reported as "not read, nothing applied". Harness: `python -m app.agent.harness` over the 10 labelled samples in `app/sim/documents/labels.json` — first run 40/40 fields, 0 invented items, 6/6 auto-applied correct.

```
upload (text | PDF | PNG/JPG) ──► Azure OpenAI Responses (input_file / input_image, structured output)
      ──► ExtractedConstraint[] ──► validator ──► tightening & confident & quote found? ──yes──► constraint: active (audit)
                                                                   └──no──► constraint: pending (operator confirms)
```

- Entry point: the 📎 in BOB chat (drawer or admin assistant). BOB replies with an extraction card: constraint, targets, window, quoted line, and Apply / Reject.
- Input: PDF as a base64 `input_file` item (the model receives extracted text and page images); images as base64 `input_image` items; text as `input_text`. Files stay in Postgres and are sent inline, so nothing is uploaded to Azure file storage.
- Output via structured outputs (`client.responses.parse(..., text_format=ExtractionResult)` with a Pydantic model). Each item carries `source_quote`, and the validator checks the quote against text extracted locally (`pypdf` for PDFs). Image quotes cannot be verified, so image-derived items always need confirmation.
- `ExtractedConstraint`: `kind` (`storm`, `curtailment_order`, `line_derate`, `asset_outage`, `maintenance_notice`, `demand_notice`), `targets` (asset codes, line codes, nodes, or `portfolio`), `start`, `end` (IST), `value` (MW cap, % derate, or severity), `source_quote`, `confidence` (0–1).
- Validator: targets exist; window within 7 days and not in the past; magnitude within asset or line limits.
- Auto-apply only when the constraint **tightens** (reduces a limit or availability, or raises reserve), confidence ≥ 0.8, and the quote is verified. Anything that loosens a limit always waits for a human.
- Reliability evidence: 20 labelled sample documents in `server/tests/fixtures/documents/` with expected JSON; an opt-in harness (costs API calls) reports field-level accuracy and the auto-apply precision. Sample documents are clearly marked as simulated and use no real agency logos or letterheads.

## Prompt outline (cycle)

System prompt (stable, cached): role as supervisory orchestrator for an Indian utility portfolio; the five profiles and when each fits; the regret rule and the 10 % discretion limit; rationale style (state the deciding criterion and its cost in ₹ or MWh, no speculation beyond tool outputs); never claim an action executed.

User message (volatile): cycle id, sim time, trigger and material events.
