# PlugAI user manual

PlugAI runs a simulated renewable energy portfolio in Andhra Pradesh (solar, wind, two batteries, an industrial cluster and a market connection) in 15-minute blocks. **BOB** is its AI operator. Every block it plans what each asset should do, acts within the limits you set, asks you when an action is above its authority, and explains every decision. Each run is also settled under **today's practice**: batteries on a fixed clock and a trading desk. That gives you a fair comparison on the same weather and prices.

```
                         ┌──────────── header: Portfolio · Actions · Simulation · Ask BOB · run clock · Inject event · New run · account menu (Settings, Sign out)
                         │
 Portfolio ──► Site ─────┼─ Site details ── Data sources ──► Connect data source
   │            │        ├─ Live overview  (weather, alerts, what BOB is doing, chart, energy flow)
   │            │        ├─ AI Actions     (executing now, waiting for you, watch conditions)
   │            │        ├─ Maintenance    (jobs, BOB's proposals to move them or inspect)
   │            │        └─ Activity log   (what happened and why)
   │            └─ Configure BOB ──► Setup wizard (with BOB's chat)
   ├─ Actions ──► View evidence ──► Decision page (options, stress tests, BOB's reason)
   ├─ Simulation (what-if · replays BOB vs today's practice)
   └─ Ask BOB page and drawer (questions · what-if · draft setups · 📎 documents)
```

Everything is simulated: weather, prices, plants, grid, market and maintenance systems. Nothing connects to a real asset.

## 1. Start the application

You need Docker, Node.js and Python 3.12. From the repository root:

```sh
make setup        # once: .env files, web and Python dependencies
make db-up        # PostgreSQL in Docker
make migrate      # database schema
make seed         # the demo portfolio and its running story (safe to repeat)
make server-dev   # API on http://localhost:8000
make worker       # the simulation clock, in a second terminal
make web-dev      # the app on http://localhost:5173, in a third terminal
```

Open http://localhost:5173, choose **Create account**, and sign in.

**BOB's language model (optional).** Put the Azure OpenAI endpoint, key and deployment name in `server/.env`:

```
MICROSOFT_AZURE_OPENAI_ENDPOINT=…
MICROSOFT_AZURE_OPENAI_KEY=…
MICROSOFT_AZURE_OPENAI_DEPLOYMENT_NAME=…
```

Without them, the header shows **Rules only**. Everything still works: the optimiser and rules make every decision, and Ask BOB explains that it is offline.

## 2. Run the simulation

Use **New run** in the header to start a scenario. Starting a run ends the previous one.

| Scenario | What happens |
| --- | --- |
| Demo story | The full story in one day: cloud bank, evening price spike, Battery 2 trip, north corridor derate, then a storm bulletin for an afternoon storm, with maintenance calendared inside it |
| Calm day | Normal conditions: battery arbitrage against the fixed clock |
| Evening spike | Real-time prices rise 50 % from 18:00 to 22:00 |
| Congestion | A windy afternoon fills the north corridor |
| Storm day | The storm story on its own |

A run fast-forwards to 10:45 and then runs live. The header controls:

- **▶ / ❚❚** play and pause. **⏭** steps one block while paused.
- **10× / 30× / 60×** sets the speed. At 30×, a 15-minute block takes 30 seconds.
- **Inject event** adds an event now: cloud bank, wind ramp, storm, price spike, battery trip, line derate, demand surge, frequency dip, or forecast update. BOB re-plans the block straight away when it can see the event.
- The **mode chip**, at the top of the Portfolio page and each site, shows the operating mode and who set it, for example "Grid support · BOB" or "Balanced · operator".
- **BOB online / Rules only** shows whether the language model is available.

If a yellow banner says **"The simulation clock is behind"**, no worker is running. Start `make worker`.

## 3. Portfolio

The landing page shows the following:

- **Capacity cards** for solar, wind, batteries and demand.
- **BOB's card.** It leads with the decision that waits for you (Approve, Decline, Ask BOB, View evidence). Below that are BOB's latest decision and its reason.
- **Sites table.** It lists each site's output now against its forecast, battery charge, status, what BOB is doing there, and approvals waiting.
- **Today with BOB vs today's practice.** This compares net cost, curtailment, deviation from schedule and carbon on the same simulated day.
- **Transaction history.** It lists every action, who initiated it, and its status.

## 4. A site

Open a site from the table.

- **Site details** lists the assets and the site's **data sources**. Use **Connect data source** to do either of the following (both are simulated):
  - **Import a telemetry CSV.** Required columns are `timestamp, asset, power_mw`. Optional columns are `available_mw, soc_pct, voltage_v, cell_temp_c, status, frequency_hz`. The page detects column types and shows a preview before you import. "Download this run's telemetry" gives you a valid sample file.
  - **Test an API connection.** The simulator answers the test. The API key is not stored.
- **Live overview** shows weather, alerts, and **what BOB is doing this block**. It also has the generation chart: actuals up to now, then the forecast with its P10–P90 range and BOB's planned battery power. The energy flow shows where power comes from and goes.
- **AI Actions** shows what is executing now, what waits for your approval, and the **watch conditions** with their current value.
- **Maintenance** lists jobs with their calendared time and BOB's schedule, and BOB's proposals. Proposals can move a job (for example out of a storm window, with the ₹ of output lost) or send an inspection crew after a storm or a battery trip. Today's practice always keeps the calendared time.
- **Activity log** shows what happened and why, newest first. You can filter it by decisions, actions, maintenance, events, documents and configuration.

## 5. Approvals

BOB acts alone only within each action's **automatic limit**. Anything larger, or anything set to need approval, waits for you. It shows on the **Actions** page, the site's AI Actions tab and the portfolio card, with a deadline in sim time.

- **Approve** sends it. It replaces BOB's fallback action of the same kind.
- **Decline**, or letting the deadline pass, keeps the fallback. While an action waits, BOB still does as much as it may do alone. For example, it buys up to its 60 MW limit while a 70 MW purchase waits for you.
- **View evidence** opens the decision page. It shows what BOB saw, the operating mode and why, the options it compared and how they differ, a cost–carbon trade-off chart, and a stress-test grid (worst-case regret per scenario). It ends with BOB's reason. "BOB (rules)" means the rules made that choice without the language model.

## 6. Ask BOB

Open the **Ask BOB** tab in the header, or use an **Ask BOB** button on a card to open it in a side drawer with the question ready. The quick-question chips send common questions. Answers stream in as BOB writes them, and a status line shows what it is checking. Try these:

- "Why did you choose the plan for the latest block?"
- "Explain action 123." The **Ask BOB** button on any action does this for you.
- "What if Battery 2 trips and demand rises 10 %?" BOB answers with a side-by-side plan. Nothing is executed.
- "Set Battery 1 discharge to run automatically up to 8 MW and test it." BOB drafts the setup and runs its tests. **Review and activate in setup** opens the wizard at that draft. BOB never activates anything itself.
- "Remove the minimum battery reserve." A **Safety rule blocked this setting** card explains the allowed range.

**Documents (📎).** Upload a PDF, text file or photo, or pick a simulated sample (storm bulletin, corridor derate, curtailment order photo, corridor uprating, shift roster). BOB reads it into constraints such as a storm window, a line limit, an asset out of service or an output cap. Each comes with the quoted line from the document.

- **Applied automatically** happens when it tightens a limit, BOB is confident, and the quote is found in the document. BOB re-plans straight away.
- **Needs your confirmation** applies to anything that raises a limit, or that comes from a photo (whose quote cannot be checked). Use **Apply** or **Reject**. **Withdraw** removes an applied constraint.

## 7. Configure BOB

**Configure BOB** on a site lists every action BOB may take there, filtered by All, Active, Paused or Drafts. Each card shows its status and today's activity, and you can pause one with its toggle; expand it to see its trigger conditions and execution rules. **Add new action** or **Edit action** opens the setup wizard: the four steps as cards from BOB, BOB's chat below them, and the site's configured actions on the right:

1. **Select** the asset and the action.
2. **Configure:**
   - **How BOB acts:** recommend only, approval required, or automatic within limits.
   - **Limits:** the maximum, the automatic limit, the battery reserve and a minimum sell price.
   - **Approval response time.**
   - **A watch condition.** When it is crossed, BOB re-plans once and flags it.
3. **Test** in the simulator against current conditions, the largest battery being unavailable, and demand at P90. All three must pass.
4. **Review** the changes against the version in force, and **Activate** it as a new version.

**Protected limits** are organisation rules that no setting can loosen: battery reserve never below 30 %, and approval for any action above 100 MW. They are shown with a lock.

**Settings** (in the account menu, the initials at the top right) sets the **default operating mode**: Balanced, Economic, Clean, Resilience or Grid support. BOB and the rules switch mode for a situation within guard floors, then return to this default.

## 8. Simulation

- **What-if** plans the block in progress again with changes you choose and shows it beside the current plan. You can take assets out of service, change line limits, or change demand, renewables or prices by a percentage, or pick a mode.
- **Replay** runs a scenario over 1–20 seeds (different days of weather, demand and prices). It compares BOB with today's practice in box plots and a per-seed table, plus a reliability summary covering hard-limit violations, unserved energy, safe holds, unanswered approvals, and how BOB's model calls ended. Replays use the rules with one plan per block, and nobody answers approvals. One worker covers 5 seeds in about 2–3 minutes.

## 9. The six-minute demo

1. **New run → Demo story**, then play at 30×. The portfolio fills in, and the net saving against today's practice is visible from the morning.
2. **11:07 cloud bank.** A toast appears. Open Kuppam Solar Site → Live overview to see the below-forecast alert, what BOB is doing, and the revised forecast.
3. **11:10 price spike.** The mode chip changes. Open the latest decision with **View evidence**.
4. **11:12 Battery 2 trips.** Approve the action waiting on the portfolio card or the Actions page. Chittoor Hybrid → Maintenance shows an inspection proposal.
5. **11:14 north corridor derate.** Anantapur Wind Site → Activity log shows the derate and BOB's re-plan.
6. **11:20 storm bulletin.** Open Ask BOB → 📎 → *Storm bulletin*. The storm is applied with its quote, the mode becomes Resilience, and Tirupati Wind → Maintenance proposes moving the 14:00 job out of the storm.
7. **Configure BOB** on Kuppam → edit Battery 1 discharge with BOB's chat → test → activate.
8. **Simulation:** run a what-if, then replay Demo story over 5 seeds.

## 10. Troubleshooting

| You see | Do this |
| --- | --- |
| "The simulation clock is behind" | Start `make worker` (several workers are fine) |
| "Rules only" in the header | Add the Azure OpenAI settings to `server/.env` and restart the API and worker |
| New behaviour does not show after an update | Restart the worker; it does not reload code |
| A new scenario's events are missing | Start a new run: a run keeps the scenario it started with |
| You want a clean slate | `make db-down && make db-up && make migrate && make seed` |

## Glossary

- **Block:** 15 minutes, the Indian market's scheduling interval.
- **Day-ahead / real-time market:** power bought a day ahead, and adjusted in real time up to four blocks before delivery.
- **DSM:** the penalty for drawing more or less than scheduled.
- **P10 / P50 / P90:** low, expected and high forecasts.
- **Operating mode:** the trade-off BOB plans for (cost, carbon, reserve, schedule discipline).
- **Worst-case regret:** how much an option would lose, in its worst stress scenario, against the best plan for that scenario. BOB chooses the option with the least.
- **Today's practice:** the comparison policy. Batteries charge 10:00–15:00 and discharge 18:00–22:00 on a clock; a desk buys forecast shortfalls; maintenance follows the calendar.
