# Methodology: live INTENSITY and THRESHOLD levers

This document defines every number the Channel Analysis tab shows when a planner moves the two sliders. The code is in `src/utils/scenario.ts` (engine), `src/utils/dataAudit.ts` (data flags) and `src/utils/scenario.test.ts` (invariants). Run `INTENSITY=15 THRESHOLD=70 AUDIT=1 npx vite-node scripts/model-report.ts` to print the numbers for every market and SCR.

## 1. What the data contains, and what it does not

Per channel, per market and SCR (`src/data/santoor_multimarket_data.json`): Santoor reach %, best-competitor reach %, gap (Santoor minus best competitor), channel share, and two indices (versus baseline, versus competition). Karnataka also carries an ATC index.

The data has **no spend, no GRPs, no CPRP, no net or campaign reach, and no overlap between channels.** Consequences that shape the design:

- Channel reaches are **never summed into an audience reach %**. In UP Overall the 39 channels with Santoor reach sum to 160.9, but the audience reach is not knowable from this file. Sums are called **reach-points** and are always labelled duplicated.
- `channelShare` is non-zero for only 96 of 248 UP channels and its meaning is unverified. It is **not** treated as spend or weight. It is used only as (a) the existing white-space filter (share >= 1%) and (b) a tie-breaker when ranking.
- The `marketShare` block is not shown anywhere.
- There are no rupees, no "budget" and no "ROI" in the tool. The unit is **weight**, measured in reach-points.

## 2. Definitions

| Term | Definition |
|---|---|
| In scope ("eligible") | The existing actionable set: Santoor reach >1%, or >0.5% with channel share >0.5%, or white space (Santoor 0, competitor >=2%, share >=1%). Computed from all channels of the market/SCR. Search, genre, sort and "Show all" never change it. |
| Active | In-scope channel with Santoor reach > 0. |
| Weight of a channel | Its observed Santoor reach, in reach-points. |
| Roster weight | Sum of weight over active channels. |
| Protected (THRESHOLD) | The top X% of active channels ranked by Santoor reach (ties: channel share, then name), `ceil(n * X / 100)` of them. Frozen before any rule runs: never a donor, never DECREASE. They can still receive weight where Santoor trails. |
| Unprotected weight | Roster weight minus protected weight. |
| Requested move (INTENSITY) | `intensity% x unprotected weight`, in reach-points. |
| Moved | What the engine actually reallocates. At most the request. |

Because THRESHOLD counts channels and not weight, protecting the top 70% of channels typically freezes 88-97% of the roster weight (the tool shows this next to the Protected card).

## 3. Roles (decided before any weight moves)

A channel is held (always MAINTAIN) if it carries a data flag (section 7). Otherwise:

- **Receiver (INCREASE candidate):** Santoor reach > 0, best-competitor reach >= 0.5, and the competitor leads by >= 1.0 pt.
- **Receiver (ADD candidate):** Santoor reach 0, competitor reach >= 2.0, channel share >= 1.0 (the original white-space rule).
- **Donor:** unprotected, Santoor reach >= best-competitor reach (index >= 100), competitor reach >= 0.5.
- Everything else is MAINTAIN.

A donor never gives more than 50% of its own weight, and never so much that its projected reach falls below the competitor's (it cannot be turned from a leader into a laggard by the cut).

## 4. Response curve

Each channel gets a concave, saturating curve of reach against weight:

```
R(w) = Rmax * (1 - exp(-k * w))
```

anchored on the observed point: `R(w_i) = r_i` with `w_i = r_i`, so `k = -ln(1 - r_i / Rmax) / r_i`. Marginal return at weight `w` is `k * Rmax * exp(-k * w)`.

| Role | Ceiling `Rmax` | Why |
|---|---|---|
| Receiver on a channel where Santoor is behind | `r + phi * (c - r)` | Never above the competitor's reach `c`. `phi` is the share of the gap that is attainable at saturation. |
| Donor on a channel where Santoor leads | `r * (1 + eta)` | No uplift is claimed on a leading channel; `eta` is residual headroom (more headroom = steeper loss when cut). |
| ADD (new channel) | `0.5 * phi * c` | Entry reach well below the competitor's. Curve starts at (0, 0); weight converts to reach at 0.5x the rate of an established channel (entry friction) and the curve is calibrated so a new channel earns the roster-average yield (1 reach-point per weight point) at 60% of its ceiling. |

## 5. Allocation: greedy water-filling

1. Move weight in slices of `unprotected weight / 200`.
2. For each slice, take from the donor with the lowest marginal return (ties: strongest lead, then channel share, then name) and give to the receiver with the highest marginal return (ties: largest gap, then share, then name).
3. Stop when any of these holds: the requested move is reached; no donor or receiver has capacity; or the best receiver's marginal return is below **1.15x** the cheapest donor's (moving more would not pay for itself).
4. A new channel is only ever funded in one block large enough to give at least 0.5 reach-points of entry reach (base curve); smaller entries are not recommended.
5. A receiver stops at the point where its projected reach would close 60% of its gap (INCREASE) or reach 90% of its entry ceiling (ADD).

The sequence of moves depends only on the data and the threshold. Intensity decides how far along that sequence the engine goes, so raising intensity can only extend the previous result. Weight moved and the number of intervened channels never fall as intensity rises.

Every channel gets exactly one action: ADD (weight added to a new channel), INCREASE (weight added), DECREASE (weight removed), MAINTAIN. The four counts add up to the number of in-scope channels. HIGH priority = an INCREASE with a gap of 5+ pts, or an ADD with competitor reach above 5%.

When nothing, or less than requested, can move, the app says why (no leading unprotected channel, benefit rule, donor limit, or entry floor).

## 6. Layer 2: "Indicative scenario - modelled, not a forecast"

Computed on **touched channels only**, from the allocation above. Reported as base case with a low-to-high range.

| Metric | Formula |
|---|---|
| Net change in reach-points | sum over receivers of (projected - current reach) minus sum over donors of (current - projected reach). Duplicated reach-points, not audience reach. |
| Gain / loss | the two parts of the line above. |
| Competitor gap closed | gain on receivers / current gap `(c - r)` of those receivers (new channels count their full `c`). Capped at 60% per channel. |
| Donor reach given up | loss on donors / current reach of those donors. |

**Low / base / high are curve-shape sensitivity**, not statistical intervals. The allocation is fixed (base); only the curves used to project it change:

| Case | `phi` (share of gap attainable) | `eta` (donor headroom) | Meaning |
|---|---|---|---|
| Low | 0.50 | 0.50 | Receivers saturate sooner, donors lose more per point. |
| Base | 0.75 | 0.25 | |
| High | 1.00 | 0.10 | Receivers reach the competitor level at saturation (but still capped at 60% of the gap per channel), donors lose less. |

Layer 2 is suppressed when a region has fewer than 8 active channels. Layer 1 still works there.

### Guardrails enforced in code and tests

- Projected channel reach never exceeds the competitor's reach where Santoor is behind; no uplift is claimed on leading channels.
- Gap closed <= 60% per channel; entry reach on a new channel <= 50% of competitor reach.
- A donor gives <= 50% of its weight and never falls below competitor parity.
- At intensity 0 nothing changes and the Layer 2 delta is exactly 0.
- No NaN or Infinity anywhere, for every intensity 0-100 and threshold 0-100 (step 5), every market and every SCR.

## 7. Data audit flags (flag, never alter)

The data is displayed as supplied. Three flags decide only whether the engine may act on a channel; flagged channels are always MAINTAIN, with the reason shown in the row.

| Flag | Rule | Why |
|---|---|---|
| `REGIONAL_LANGUAGE` | Channel name matches a language that is not the market's home language (e.g. Telugu, Tamil, Malayalam, Gujarati or Marathi in UP; Telugu or Tamil in Karnataka) and the channel has reach. | A planner would not normally buy it for this market. The reach may reflect border-area viewing or a data issue; that cannot be verified from this file. Name patterns are in `dataAudit.ts` and are deliberately short and explicit. |
| `NO_COMPETITOR_REF` | Santoor reach > 0 and competitor reach < 0.5. | The 999 index sentinel, or an index computed on a near-zero denominator (for example 733 on 0.44 vs 0.06). Lead cannot be assessed. The table shows the index as "n/a". |
| `HIGH_REACH` | Santoor reach > 40% on one channel. | Verify before acting (Zee Kannada, Udaya TV, Colors Kannada Cinema and Udaya Music exceed it in Karnataka). |

The table INDEX column shows `n/a` where competitor reach is under 0.5, instead of printing 999.

## 8. What the tool does NOT claim

- It is not a forecast, a media plan, a buy list or an optimiser of spend. It has no spend data.
- Reach-points are not audience reach. Overlap between channels is unknown and no deduplication is attempted.
- It does not know the cost of a reach-point on any channel; "weight" is a proxy equal to observed reach.
- The response-curve shape is an assumption (concave and saturating). The low/base/high range shows how much the answer depends on that assumption; it is not a confidence interval.
- The average reach gap card is a simple unweighted average over channels, as in the original tool. Its scenario value is modelled on the base curve.
- Karnataka is an ATC market in the source file, but the engine uses the reach and gap fields exactly as in the other markets. ATC index is shown as observed and is not modelled.
- Timeband figures are synthetic sample data and are hidden unless the URL has `?debug=1`.
- At the default levers the model moves little or nothing in some markets (see the PR). That is a finding about the data (every unprotected UP and Karnataka channel is either behind or has no usable competitor reference), not a bug.

## 9. Data that would upgrade the model

| Data | What it would enable |
|---|---|
| Spend, GRPs or CPRP per channel | A real weight (cost) instead of the reach-point proxy, a real cost per reach-point, true budget-neutral reallocation. |
| Channel-to-channel overlap (or a deduplicated reach file) | Net reach as an audience percentage instead of duplicated reach-points; sound donor choice (a donor whose viewers are reached elsewhere costs nothing). |
| Measured response curves (flighting tests, weekly reach build) | Replace the assumed curve and the low/base/high shape sensitivity with a calibrated range. |
| Verified meaning of `channelShare` and `marketShare` | Use them as weights rather than tie-breakers. |
| Measured timeband reach | Re-enable the timeband tab. |
| Language and region tags per channel | Replace the name-pattern audit with an authoritative one. |

## 10. Parameters (single source: `MODEL_PARAMS` in `scenario.ts`)

| Parameter | Value |
|---|---|
| Min gap to INCREASE | 1.0 pt |
| White-space rule | competitor >= 2.0, share >= 1.0 |
| Min competitor reference | 0.5 |
| Max cut per donor | 50% of its weight |
| Max gap closed per channel | 60% |
| Entry cap | 50% of competitor reach |
| Min entry reach (new channel) | 0.5 reach-points |
| Benefit rule (gain / loss) | 1.15x |
| Entry friction / reference saturation | 0.5 / 0.6 |
| Slices | 200 |
| Layer 2 minimum active channels | 8 |
| Bands (`phi`, `eta`) | low (0.50, 0.50), base (0.75, 0.25), high (1.00, 0.10) |
