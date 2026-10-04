# 01 — Decision model for one cycle

```
 trigger: block tick (every 15 min) │ material event (mid-block)
        │
        ▼
 [1] observe ── telemetry(t0) + latest forecasts (P10/P50/P90) + active constraints + positions
        │
        ▼
 [2] situation features ──► [3] profile (BOB, guarded by rule floors) ──► effective params
        │                                                                     │
        ▼                                                                     ▼
 [4] scenario set S (expected + stresses; BOB may add from library)   [5] stage A: min reliability slack  → Z*
        │                                                                     │
        │                                                     [6] stage B × K variants → K candidate plans
        │                                                                     │
        └──────────────► [7] robust evaluation: fix here-and-now(k), re-solve under s ──► regret matrix K×S
                                                                              │
                                              [8] select (BOB within regret tolerance, else min-max regret)
                                                                              │
                                              [9] independent validator → policy tiers → fallback for gated
                                                                              │
                                              [10] execute here-and-now actions (mock adapters) → verify next block
```

Interval Δ = 0.25 h. Blocks are numbered from the run start; `t0` is the block being decided. Horizon `H = 96` blocks (24 h, configurable; rollouts may use 48).

## 1. Sets and data

| Symbol | Meaning | Source |
| --- | --- | --- |
| `T = {t0 … t0+H-1}` | Planning blocks | Clock |
| `R` (solar ∪ wind), `B`, `C`, `G`, `N`, `L` | Renewable plants, batteries, consumers, interconnections, nodes, lines | `asset`, `node`, `line` |
| `A_it` | Available renewable MW (P50 in stage A/B; scenario value in robust evaluation) | `forecast` |
| `D_kt`, `Dcrit_kt` | Consumer load and its critical part (MW) | `forecast`, `asset.params` |
| `p_t^dam`, `p_t^rtm` | Day-ahead and real-time prices (₹/MWh) | `forecast` (price series) |
| `S_t^dam` | Day-ahead net position (MW, + = buy), fixed | Run initialisation |
| `S_t^rtm,fixed` | RTM positions already cleared for `t < t0 + G` | Previous cycles' actions |
| `G` | RTM gate lead in blocks (default 4 ≈ 1 h) | `portfolio.market` |
| `ef_t` | Grid emission factor (tCO₂/MWh) | Simulator series |
| `f_t0` | Latest grid frequency (Hz) | Telemetry |
| Active constraints | Derates, outages, curtailment caps, storm windows, reserve uplifts | `constraint` (status active) |

## 2. Decision variables (per block `t`)

| Domain | Variables (MW unless noted) | Notes |
| --- | --- | --- |
| Renewables | `g_it ∈ [0, min(A_it, cap_it)]` | Curtailment `c_it = A_it − g_it`. `cap_it` from curtailment orders / derates. Non-curtailable plants: `g_it = A_it`. |
| Battery | `ch_jt, dis_jt ≥ 0`, `soc_jt` (MWh), mode `u_jt ∈ {0,1}`, up-reserve `r_jt ≥ 0` | Binary prevents simultaneous charge and discharge. |
| Consumers | DR reduction `y_kt`, shift out `o_kt`, shift in `i_kt`, unserved `us_kt` (split critical / non-critical) | Unserved is a slack, never a plan. |
| Network | `imp_gt, exp_gt ≥ 0`, line flow `fl_lt` (signed) | Radial corridors in the demo portfolio. |
| Market | RTM buy `b_t`, sell `q_t` ≥ 0 for `t ≥ t0 + G`; deviation `d⁺_t, d⁻_t ≥ 0`, split into in-band and beyond-band parts | Positions before the gate are fixed. |
| Reliability slack | `rs_t ≥ 0` (reserve shortfall) | Penalised in stage A. |

## 3. Constraints

1. **Node balance** for each node `n`, block `t`:
   `Σ_{i∈R(n)} g_it + Σ_{j∈B(n)} (dis_jt − ch_jt) + Σ_{g∈G(n)} (imp_gt − exp_gt) + Σ_{l into n} fl_lt − Σ_{l out of n} fl_lt = Σ_{k∈C(n)} (D_kt − y_kt − o_kt + i_kt − us_kt)`
2. **Battery** `j`:
   `soc_j,t+1 = soc_jt + Δ·(η_c·ch_jt − dis_jt/η_d)`; `SOCmin_j ≤ soc_jt ≤ SOCmax_j`; `ch_jt ≤ P_j·avail_jt·u_jt`; `dis_jt ≤ P_j·avail_jt·(1 − u_jt)`;
   reserve `r_jt ≤ P_j·avail_jt − dis_jt + ch_jt` and `r_jt·h_res ≤ (soc_jt − SOCfloor_j)·η_d` (`h_res` = reserve duration, default 1 h; `SOCfloor` from profile, ≥ `SOCmin`);
   terminal `soc_j,end ≥ SOCterm_j` (default: current SOC, so the plan does not borrow from tomorrow);
   warranty cycle budget per calendar day: discharge in the rest of today ≤ `E_j·cycles_per_day_j` minus what was already discharged today; the part of the horizon in tomorrow gets a full day's budget. The demand-response energy allowance works the same way, and shifted load must net to zero within each day (soft, ₹50,000/MWh).
3. **Reserve requirement** `Σ_j r_jt + rs_t ≥ R_t` where `R_t` = profile share × total battery power (the batteries are the only fast reserve; a share of peak load would exceed their 25 MW), raised by active storm windows and by frequency stress (`|f_t0 − 50| > 0.05 Hz` adds the profile's frequency uplift for the next 4 blocks).
4. **Consumers** `y_kt ≤ F_k` only for `t ≥ t0 + notice_k`, `Σ_t y_kt·Δ ≤ Edr_k`; `o_kt, i_kt ≤ Smax_k` inside the consumer's shift window; `Σ_t o_kt = Σ_t i_kt`; `us_kt ≤ D_kt − y_kt − o_kt`.
5. **Network** `|fl_lt| ≤ Lim_lt`; `imp_gt ≤ Imax_gt`, `exp_gt ≤ Emax_gt` (limits after active constraints).
6. **Market and schedule** (portfolio level, as Indian scheduling works at the entity periphery):
   `X_t = Σ_g (imp_gt − exp_gt)`; `Sched_t = S_t^dam + S_t^rtm,fixed + b_t − q_t`; `X_t − Sched_t = d⁺_t − d⁻_t`.
   Tolerance band `d^±_in ≤ band_t`, where `band_t = min(band_pct·|Sched_t|, band_mw)` (configurable; defaults 10 % and 100 MW — check against CERC DSM Regulations 2024 before the demo).
7. **Here-and-now locks.** Variables for blocks already executed or committed are fixed to their committed values.

## 4. Objective terms (all in ₹ or ₹-equivalent)

| Term | Expression | Reported as |
| --- | --- | --- |
| Market cost | `Σ_t p_t^rtm·(b_t − q_t)·Δ` (DAM cost is fixed and excluded from optimisation, included in reporting) | ₹ |
| Deviation charge | `Σ_t [ r⁺_t·d⁺_in − r⁻_t·d⁻_in + m·r⁺_t·(d⁺_out + d⁻_out) ]·Δ`, `r⁺_t = p_t^rtm·(1 + α·freqstress_t)`, `r⁻_t = β·p_t^rtm` | ₹, MWh |
| Demand flexibility | `Σ ρ_k·y_kt·Δ + Σ σ_k·o_kt·Δ` | ₹ |
| Battery wear | `Σ c_deg,j·dis_jt·Δ` | ₹, MWh throughput, cycles |
| Curtailment compensation | `Σ κ_i·c_it·Δ` (PPA tariff for contracted IPP plants, 0 for owned) | ₹, MWh |
| Carbon (shadow) | `λ_C·Σ_g Σ_t ef_t·imp_gt·Δ` | tCO₂ |
| Curtailment (shadow) | `λ_U·Σ c_it·Δ` | MWh, utilisation % |
| Battery preservation (shadow) | `λ_D·Σ dis_jt·Δ` | — |
| Schedule tracking (shadow) | `λ_S·Σ (d⁺_t + d⁻_t)·Δ` | MWh |
| Reliability (stage A only) | `VoLLcrit·Σ us^crit + VoLL·Σ us^noncrit + VoRS·Σ rs_t`, all ×Δ | MWh |

"Profit" in the brief is the negative of net cost; "renewable utilisation" is `1 − curtailment / available`. Both are reported, not optimised separately.

## 5. Two-stage solve

- **Stage A — reliability first.** Minimise the reliability term only. Result `Z*`.
- **Stage B — economics within reliability.** Add `reliability ≤ Z* + ε` (ε = 0.1 MWh) and minimise the sum of the economic and shadow terms with the profile's λ values.

Safety and reliability therefore can never be outvoted by a better economic score.

## 6. Objective profiles

Profiles are versioned rows (`profile` table), editable without a deploy. Defaults below are starting values to calibrate on the Simulation page.

| Profile | Reserve share of battery power | SOC floor | λ_C ₹/tCO₂ | λ_U ₹/MWh | λ_D ₹/MWh | λ_S ₹/MWh | Other |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `balanced` | 20 % | 20 % | 2,000 | 1,500 | 500 | 500 | — |
| `economic` | 10 % | 15 % | 1,000 | 1,000 | 300 | 300 | — |
| `clean` | 20 % | 20 % | 4,000 | 5,000 | 500 | 500 | — |
| `resilience` | 60 % | 50 % | 2,000 | 1,500 | 300 | 1,500 | RTM sell capped at 50 % of export limit |
| `grid_support` | 40 % | 30 % | 2,000 | 1,500 | 500 | 3,000 | Frequency uplift doubled |

**Rule selection and guard floors** (deterministic; used as fallback and as a floor under BOB's choice):

| Signal (from §8) | Rule profile | Guard floor applied regardless of profile |
| --- | --- | --- |
| Storm window active or within 6 h | `resilience` | Reserve ≥ 20 %, SOC floor ≥ 50 % for affected batteries |
| Battery or plant outage and reserve margin < 1.2 × requirement | `resilience` | — |
| Frequency outside 49.90–50.05 Hz or corridor utilisation > 95 % | `grid_support` | λ_S ≥ 1,500 |
| Announced (revealed) price spike ahead today, or hourly RTM forecast > 160 % of the known day-ahead price | `economic` | — |
| Forecast export > export limit or RTM price < ₹1,500/MWh | `clean` | — |
| Otherwise | `balanced` | — |

Precedence: resilience > grid_support > economic > clean > balanced. The operator's default mode (`portfolio.mode_code`) applies when no signal fires; a signal switches the mode only for as long as it lasts. Effective parameters = the chosen profile, then each guard floor applied with `max`. The UI's mode chip shows the active mode and who set it (operator, rule or BOB).

## 7. Candidate plans (F2 options)

From the effective parameters, solve stage B for K = 5 variants and keep distinct ones (distinct = different here-and-now actions):

| Variant | Change from effective params |
| --- | --- |
| `profile` | none |
| `cost` | all λ × 0.25 |
| `clean` | λ_C, λ_U × 4 |
| `preserve` | λ_D × 4 |
| `secure` | reserve share × 1.5 (re-runs stage A) |

Solves per cycle: 2 stage-A + 5 stage-B = 7.

## 8. Situation features and events

Computed by `state/` each cycle and stored in `cycle.situation`:

| Feature | Material when (defaults, configurable) |
| --- | --- |
| RE forecast revision, next 4 h | > 10 % of RE capacity·h vs previous issue |
| Demand actual vs forecast | > 8 % for any consumer, or > 20 MW portfolio |
| Price outlook | RTM max over horizon > 1.5 × median or > ₹8,000/MWh |
| Asset availability | any change |
| Corridor utilisation forecast | > 90 % in next 8 blocks, or limit change |
| Frequency | outside 49.90–50.05 Hz in 2 consecutive readings |
| Storm / weather alert | any active constraint of kind `storm` |
| Execution deviation | `|actual − commanded| > 5 %` of asset capacity |
| Reserve margin | available up-reserve / requirement |
| Watch conditions | any `action_config.watch` condition crossed (e.g. "demand exceeds solar by 3 MW for 5 min") |

A material event triggers an immediate cycle and a notification to the configured channels; otherwise a cycle runs at each block tick. Watch conditions never execute an action by themselves: they make BOB re-plan.

## 9. Scenario set and robust selection

Scenario set `S` (each defined as transforms on the P50 inputs):

| Scenario | Transform |
| --- | --- |
| `expected` | P50 everywhere |
| `re_low` | Solar and wind at P10 for the next 8 blocks |
| `demand_high` | Load at P90 for the next 8 blocks |
| `bess_out` | Largest available battery unavailable from `t0+1` for 8 blocks |
| `price_spike` | RTM × 2 for evening blocks (18:00–22:00) in horizon |
| Event-specific | Added by BOB or by rule: `storm` (wind to cut-out for the alert window), `corridor` (line limit −30 %) |

**Here-and-now decisions** of a plan = everything binding now: block `t0` setpoints (battery, curtailment caps, load shift starts), RTM bids for block `t0+G`, DR calls whose start is `t0 + notice_k`.

**Regret.** For plan k and scenario s: fix k's here-and-now decisions, re-solve the rest of the horizon under s (stage B objective, reliability slack valued at VoLL) → `J_ks`. Best possible under s: `J*_s` (unconstrained solve under s). `Regret_ks = J_ks − J*_s`.

**Selection.**
1. Unserved load is priced at ₹1 lakh/MWh (critical ₹5 lakh/MWh), far above any market price, so a plan that drops load is never the least-regret choice.
2. Rule: choose min over k of max over s of `Regret_ks`; tie-break by `J_k,expected`.
3. BOB may choose a different remaining plan only if its max regret ≤ 1.10 × the minimum max regret (bounded discretion), and must state why.

Solves: K·|S| + |S| ≈ 36 small MILPs, run in a process pool.

## 10. Validation, policy and fallback

1. **Independent validator** (plain Python, does not trust the solver): block `t0` setpoints within power, SOC, interconnection and line limits after the latest telemetry; no action on an unavailable asset; balance closes within 1 MW.
2. **Configured actions are BOB's mandate.** Each asset's active `action_config` (from the setup wizard) decides what the optimiser may use and how an action is tiered:

| Condition | Effect |
| --- | --- |
| No active config for (asset, action kind) | Those variables are fixed at 0: BOB cannot use that action. |
| `max_mw`, `max_energy_mwh`, `max_duration_min`, `cooldown_min`, `max_per_day`, `reserve_pct`, `min_price_inr_mwh` | Added as hard constraints for that asset (on top of physical limits). |
| Autonomy `auto` and the action within `auto_max_mw` and no approval exception applies | Tier `auto`: executes. |
| Autonomy `approval`, or above `auto_max_mw`, or an approval exception applies (e.g. forecast confidence low, battery health not normal, live data delayed) | Tier `approval`: goes to the configured approver with its response time. |
| Autonomy `recommend` | Tier `recommend`: shown, never executed by BOB. |
| Would breach `portfolio.protected` (e.g. reserve below 30 %, critical load shed) or a physical limit | Tier `prohibited`: rejected and logged. |

A gated action's fallback plan does only what BOB may do alone: each gated decision is capped at its automatic authority (`policy.authority`: 0 when the config is approval or recommend only, otherwise the automatic limit within the protected ceiling), and an approval later supersedes the fallback's action of the same kind. Forbidding the whole kind instead left the portfolio off schedule whenever an approval went unanswered (replays: DSM ₹15.8 lakh vs ₹8.3 lakh with the cap, `calm_day`).

Maintenance moves and inspection dispatch are always `approval` (safety-critical delays: `recommend`; past deadline: `prohibited`). A config cannot be saved or activated if it loosens `portfolio.protected`; activation also requires its required test scenarios (05-ux, setup wizard) to pass in the simulator.

3. **Execution never waits for a human.** For gated actions the cycle also solves a fallback with those actions fixed to zero, and executes the fallback now. If approval arrives before the deadline (the configured response time, capped by the physical deadline: end of block for block-`t0` actions, gate closure for RTM bids, notice time for DR calls), the approved action replaces the fallback for the remainder. On expiry the gated action is cancelled, the rest of the plan keeps running, and BOB proposes it again only if the next cycle still needs it.
4. **Failure chain.** Solver timeout with incumbent → use it (gap logged). No incumbent → LP relaxation, then round battery modes (charge if `ch ≥ dis`). Solver failure → previous plan's next block if the validator accepts it. Otherwise **safe-hold**: batteries idle, no new RTM bids, curtail only what limits require.

## 11. Maintenance decisions (hourly, or on asset/weather events)

- For each task in `planned/scheduled` status with window `[earliest, deadline]`, duration `D`: candidate starts τ inside the horizon, crew available, not inside a storm window.
- Lost value `V(τ) = Σ_{t=τ}^{τ+D−1} A_at(P50)·p_t^rtm·Δ` for generators; for batteries, the selected plan's dispatch value over the window.
- Propose moving to `τ* = argmin V(τ)` when `V(current) − V(τ*) > ₹1 lakh` (configurable). Safety-critical tasks may move earlier, never later.
- Inspection dispatch proposals: (a) after a storm window, any affected plant with performance ratio `actual / expected < 0.85` for 2 blocks; (b) any trip event.

## 12. Baseline policy (today's practice, for comparison)

Same simulator and truth, separate plant state:
- Schedule = day-ahead P50; RTM used only to buy forecast shortfall beyond the band at `t0+G`.
- Batteries: charge from surplus 10:00–15:00 at constant rate, discharge 18:00–22:00, SOC limits respected.
- Curtail only when limits force it. No DR, no load shifting. Maintenance as calendared.

## 13. Size and time budget

~55 variables per block × 96 blocks ≈ 5.3k variables, 192 binaries. Per-solve limit 2 s, MIP gap 0.5 %. Target cycle wall time ≤ 10 s with a 4-process pool; BOB adds up to 20 s, and only on cycles with a material event. Default demo speed is 30× (a block lasts 30 s wall); the clock waits for a cycle to finish rather than skipping blocks.
