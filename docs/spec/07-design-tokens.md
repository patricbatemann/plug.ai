# 07 — Design tokens

```
 @carbon/colors (IBM palette, fixed steps)          IBM Plex Sans / Mono          Carbon motion
          │                                                 │                           │
          ▼                                                 ▼                           ▼
 TIER 1  primitives ── gray10…100 · blue · green · red · yellow · purple · teal · cyan · magenta · orange
          │
          ▼
 TIER 2  semantic (Carbon theme g10, as --cds-* CSS variables)
          background · layer · field · border · text · link · focus · support-success/warning/error/info
          │                                   │
          ▼                                   ▼
 TIER 3  component (Carbon React defaults)    domain (this app, from @carbon/colors only)
          button · tag · tile · data table      energy series · BOB vs baseline · status · sequential/diverging scales
```

**Decision:** the design system is **IBM Carbon v11, light theme `g10`**: page background gray 10, white tiles and fields. Components come from `@carbon/react`; charts from `@carbon/charts-react`; colour values only from `@carbon/colors` and Carbon theme tokens. No hex literal appears in app code.

**Why Carbon:** the sample screens are already Carbon. The three most common fills are Carbon gray 70 `#525252`, white, and Carbon blue 60 `#0F62FE`, and the type is IBM Plex Sans with IBM Plex Mono for timestamps. Carbon is an industry-standard enterprise system, used widely in industrial and energy software. It has WCAG 2.1 AA contrast built into its themes, a tested data-visualisation palette, and documented motion. Using its components also means writing far less UI code.

## What changes from the sample screens

The screens mix Carbon with Tailwind and ad-hoc values. Each off-system value maps to its Carbon equivalent:

| In the screens | Where | Becomes |
| --- | --- | --- |
| `#1F2937`, `#0F172A`, `#1A1A1A`, `#000000` (Tailwind/ad-hoc darks) | headings, body | `text-primary` (gray 100 `#161616`) |
| `#64748B`, `#94A3B8`, `#666666` (Tailwind slate) | secondary text, icons | `text-secondary` (gray 70) / `text-helper` (gray 60) / `icon-secondary` |
| `#E5E7EB`, `#F3F4F6`, `#F9FAFB`, `#F5F5F5`, `#E5E5E5` | borders, fills | `border-subtle` (gray 20) / `layer-02` (gray 10) |
| `#10B981`, `#22C55E`, `#16A34A`, green Approve buttons | Approve actions | **primary button** (blue 60). Green is a status colour in Carbon, not an action colour. One approve style everywhere. |
| `#F59E0B`, `#F8B84E`, `#FEF3C7`, `#FFF8E1` (amber) | warnings, solar | `support-warning` (yellow 30) for warning icons; warning notification for banners; solar series token for charts |
| `#EF4444`, `#DC2626`, `#B91C1C`, `#E82127` | errors, avatar ring | `support-error` (red 60); danger button for destructive actions |
| `#3B82F6`, `#E8F1FF` | links, info fills | `link-primary` / `interactive` (blue 60); info notification (blue 10 background) |
| `#8B5CF6`, `#F4F0FF` | AI badges | purple tag (purple 10 / purple 70), the AI identity colour |
| 13 px text (most common size in the export) | body, tables | Carbon `body-compact-01` 14 px; dense labels `label-01` 12 px |
| Uppercase column labels | tables, KPIs | Sentence case (Carbon convention) |

Before the demo, three changes to the screens' content:

- **Branding.** The headers say "Tesla Energy" and "Powered by plug.ai", both real companies. A hackathon demo must not carry another company's brand. Use our own product name (e.g. "LaGo" or "BOB").
- **Typo.** "Kuppam Solor" should be "Kuppam Solar".
- **Units.** The screens price energy in ₹/kWh; the decision model uses ₹/MWh. Show market prices as ₹/MWh, matching the exchange convention.

## Tier 2 — semantic tokens (Carbon `g10`)

Used through Carbon's CSS variables (`var(--cds-text-primary)` etc.). Values are listed for reference only; never copy them into code.

| Token | Value | Use |
| --- | --- | --- |
| `background` | gray 10 `#F4F4F4` | Page |
| `layer-01` | white | Tiles, cards, table body |
| `layer-02` | gray 10 | Inset panels inside tiles (impact grids, "why BOB recommends this") |
| `field-01` | white | Inputs on gray background |
| `border-subtle-01` | gray 20 `#E0E0E0` | Dividers, tile borders |
| `border-strong-01` | gray 50 `#8D8D8D` | Input borders |
| `text-primary` / `text-secondary` / `text-helper` / `text-placeholder` | gray 100 / 70 / 60 / 40 | Text hierarchy |
| `interactive`, `link-primary`, `focus`, `button-primary` | blue 60 `#0F62FE` | Primary actions, links, focus ring |
| `support-success` | green 60 `#198038` | Healthy, completed, verified |
| `support-warning` | yellow 30 `#F1C21B` | Below forecast, awaiting approval |
| `support-error` | red 60 `#DA1E28` | Critical, failed, limit breach |
| `support-info` | blue 70 `#0043CE` | Informational, executing |

## Tier 3 — domain tokens

Defined once in `web/src/theme/tokens.ts` by importing named colours from `@carbon/colors`, and exposed as CSS variables at startup so CSS and charts share one source.

### Status (tags, dots, row accents)

Carbon tag pairs (10 background, 70 text) match the screens' badges:

| Status | Tag | Dot / icon |
| --- | --- | --- |
| Operating normally, completed, verified, live | green | `support-success` |
| Awaiting approval, below forecast, watching | warm-gray or yellow 10 / yellow 60 text | `support-warning` |
| Critical, failed, rejected, limit breach | red | `support-error` |
| Executing, info, under maintenance | blue | `support-info` |
| AI-generated, BOB active, BOB decision | purple | purple 60 |
| Offline, dismissed, draft, paused | gray / cool-gray | gray 50 |

### Energy series (the same in every chart and legend)

| Series | Line / mark | Area or band fill | Rule |
| --- | --- | --- | --- |
| Solar | yellow 50 `#B28600` | yellow 20 | Yellow 30 fails 3:1 contrast on white, so lines use step 50. |
| Wind | teal 50 `#009D9A` | teal 20 | — |
| Battery (discharge +, charge −) | cyan 50 `#1192E8` | cyan 20 | SOC lines use the same hue, dashed. |
| Grid import / export | blue 80 `#002D9C` | blue 20 | — |
| Demand | gray 100 `#161616` | — | Forecast dashed; P10–P90 band uses the series' step-10 fill. |
| RTM / DAM price | magenta 70 `#9F1853` | — | Secondary axis, ₹/MWh. |
| Curtailment | orange 70 `#8A3800` | orange 20, hatched | — |
| Emissions | gray 60 `#6F6F6F` | — | — |
| Shortfall / unserved | `support-error` | red 10 | Uses the status colour on purpose: it is always bad. |
| BOB | purple 70 `#6929C4` | purple 20 | Purple means BOB everywhere (tags and charts). |
| Baseline (today's practice) | gray 50 `#8D8D8D` | gray 20 | — |

All mark colours are in Carbon's categorical palette or its step-50+ siblings, so adjacent series stay distinguishable for common colour-vision deficiencies. Charts also pair colour with a second cue (dash, hatch, direct labels), never colour alone.

### Scales

- **Sequential** (regret heat map, corridor utilisation): blue 10 → blue 90, Carbon's monochromatic scale.
- **Diverging** (BOB minus baseline): red 60 ← gray 10 → green 60 for "worse / same / better", centred on zero.

## Typography

IBM Plex Sans (400, 600) and IBM Plex Mono (400), self-hosted through Carbon's font-face (no external CDN at runtime).

| Token | Size / line height | Use in this app |
| --- | --- | --- |
| `heading-05` | 32 / 40, 400 | Page title ("All AI recommendations") |
| `heading-04` | 28 / 36, 400 | KPI values (38 MW, 72 %) |
| `heading-03` | 20 / 28, 400 | Section titles |
| `heading-compact-02` | 16 / 22, 600 | Card titles |
| `heading-compact-01` | 14 / 18, 600 | Table emphasis, labels with values |
| `body-01` / `body-compact-01` | 14 / 20 and 14 / 18 | Body and table text |
| `label-01` / `helper-text-01` | 12 / 16 | Field labels, KPI captions, helper text |
| `code-01` / `code-02` | 12 / 16 and 14 / 20, Plex Mono | Timestamps, asset codes, IDs, numbers in tables (tabular figures) |

Numbers in tables and KPI tiles use tabular figures so live updates do not shift columns.

## Spacing and layout

- Carbon spacing scale only: 2, 4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96 px (`spacing-01` … `spacing-12`).
- Carbon 2x Grid: 16 columns from `lg` (1056 px), 32 px gutters, max content width 1584 px. Control-room screens target 1440 px (the screens' frame width).
- Shape: Carbon defaults (square buttons, fields and tiles). No custom radius tokens.
- Elevation: tiles are separated by layer colour and a 1 px `border-subtle`, not shadows. Shadows only on overlays (popover, menu, modal, toast), using Carbon's.

## Motion — light, cool, smooth

Carbon motion tokens only. "Productive" curves for routine UI, "expressive" for larger entrances.

| Token | Value |
| --- | --- |
| `duration-fast-01` / `fast-02` | 70 ms / 110 ms |
| `duration-moderate-01` / `moderate-02` | 150 ms / 240 ms |
| `duration-slow-01` / `slow-02` | 400 ms / 700 ms |
| `standard-productive` | cubic-bezier(0.2, 0, 0.38, 0.9) |
| `entrance-productive` / `exit-productive` | (0, 0, 0.38, 0.9) / (0.2, 0, 1, 0.9) |
| `standard-expressive` | cubic-bezier(0.4, 0.14, 0.3, 1) |
| `entrance-expressive` / `exit-expressive` | (0, 0, 0.3, 1) / (0.4, 0.14, 1, 1) |

| Interaction | Transition |
| --- | --- |
| Hover, focus, pressed colours | `fast-01`, standard-productive |
| Tabs, toggles, segmented controls | `fast-02`, standard-productive |
| Status change (Awaiting → Executing → Completed) | background and text cross-fade, `moderate-01` |
| Live value update | Value changes instantly (no count-up: operators need the true number). Its cell gets a blue 10 tint that fades out over `slow-01`. |
| Progress, SOC and capacity bars | width, `moderate-02`, standard-productive |
| Ask BOB drawer, side panels | slide and fade in `moderate-02` entrance-expressive; out `fast-02` exit-expressive |
| Modal, approval dialog | Carbon modal defaults (`moderate-02`) |
| Toasts (events, approvals) | in `moderate-01` entrance-productive; auto-dismiss after 6 s except errors |
| Route and tab content | opacity fade `fast-02`; no sliding pages |
| Charts on live data | `moderate-02` on data change; no re-entry animation on each 2 s poll |
| Loading | Carbon skeletons; no spinners for content areas |

No bounce, spring or parallax. Under `prefers-reduced-motion: reduce`, all transitions drop to 0 ms except opacity fades, which are capped at `fast-01`.

## Implementation

| Piece | How |
| --- | --- |
| Theme | `web/src/styles/carbon.scss`: `@use '@carbon/react/scss/themes'` + `@use '@carbon/react/scss/theme' with ($theme: themes.$g10)`; includes Carbon styles and Plex font-face. |
| Components | `@carbon/react`: UI Shell header, Tabs, Breadcrumb, DataTable, Tag, Tile, Button, Notification, ProgressIndicator, ProgressBar, TextInput, NumberInput, Dropdown, Pagination, Modal, Toggle, AILabel. |
| Charts | `@carbon/charts-react` (area, stacked area, line, combo, scatter, heat map, box plot, floating bar for the maintenance Gantt), with `color.scale` mapped from the energy series tokens. |
| Domain tokens | `web/src/theme/tokens.ts` imports from `@carbon/colors`, exports the series and status maps, and sets them as `--bob-*` CSS variables on load. |
| Guardrail | A frontend test fails if a hex or `rgb()` colour literal appears anywhere in `web/src` (tokens come from Carbon packages only). |
| Dark theme | Not in demo scope. Switching `$g10` to `$g100` and the series map to Carbon's dark-theme steps is the whole change, because nothing hard-codes colour. |

Carbon Charts replaces the earlier ECharts choice. New frontend packages: `@carbon/react`, `@carbon/charts-react`, `@carbon/colors`, `sass`.
