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

- **Receiver (INCREASE candidate):** Santoor reach > 0, best-competitor reach >= 0.5, and the competitor leads by >= 0.5 pt. Protected channels can receive.
- **Receiver (ADD candidate):** Santoor reach 0, competitor reach >= 2.0, channel share >= 1.0 (the original white-space rule).
- **Donor:** any unprotected, unflagged active channel with competitor reach >= 0.5. Donors are ranked by **lowest marginal reach return per weight point**, so the channels that give first are the ones where extra weight earns least: (a) leaders, which are saturated (curve ceiling `r * (1 + eta)`); and (b) channels that trail only slightly, where the remaining gap is small so the curve is already flat. The row says "Low return: ... each reach-point of weight here earns only ~0.3".
- A channel cannot be both a donor and a receiver in one scenario.
- Everything else is MAINTAIN.

A donor never gives more than 50% of its own modelled weight (a share of the reach-point proxy, not of any budget). A donor that leads its competitor is never cut below competitor parity **in any of the three displayed bands** (the cap is the tightest of the low, base and high curves).

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
| Donor on a channel where Santoor trails | `r + phiDonor * (c - r)` | Same shape as a receiver; the closer to the competitor, the flatter the curve and the cheaper the cut. |
| ADD (new channel) | `0.5 * phi * c` | Entry reach well below the competitor's. Curve starts at (0, 0); weight converts to reach at 0.5x the rate of an established channel (entry friction) and the curve is calibrated so a new channel earns the roster-average yield (1 reach-point per weight point) at 60% of its ceiling. |

## 5. Allocation: greedy water-filling

1. Move weight in slices of `unprotected weight / 200`.
2. For each slice, try receiver/donor pairs in order of base-case return: receivers from highest marginal return (ties: largest gap, share, name), donors from lowest (ties: strongest lead, share, name). The first pair that passes the benefit rule and the low-curve check (step 3) is used. **A failing pair is skipped and the next pair is tried**; the engine stops only when no feasible pair remains or the request is met. The result carries a self-check (`residualMoves`) that is 0 whenever it reports used-up headroom.
3. Stop when any of these holds: the requested move is reached; no donor or receiver has capacity; the best receiver's marginal return does not beat the cheapest donor's (moving more would not pay for itself); or the next slice would have a **negative net change under the low curve** (see section 6). A move is therefore only ever made if it is robust to the pessimistic curve.
4. A new channel is only ever funded in one block large enough to give at least 0.5% of entry reach (base curve); smaller entries are not recommended. The block is funded by the base-ranked mix of donors, or, if that mix fails the low-curve check, by each single donor with enough capacity (best low-case net first). Only if no such plan passes is the channel left unfunded, and unfunded channels are re-tested as donor state changes. The headroom check and the useful-range marker count a fundable new channel as remaining headroom.
5. A receiver stops at the point where its projected reach would close 60% of its gap (INCREASE) or reach 90% of its entry ceiling (ADD).

The sequence of moves depends only on the data and the threshold. Intensity decides how far along that sequence the engine goes, so raising intensity can only extend the previous result. Weight moved and the number of intervened channels never fall as intensity rises.

Every channel gets exactly one action: ADD (weight added to a new channel), INCREASE (weight added), DECREASE (weight removed), MAINTAIN. The four counts add up to the number of in-scope channels. HIGH priority = an INCREASE with a gap of 5+ pts, or an ADD with competitor reach above 5%.

### Useful range of the intensity slider

`computeUsefulIntensity` returns, for the current market, SCR and threshold, the lowest whole-% intensity at which the moved weight equals the moved weight at 100%. The slider (0-30%, step 1) shows a hatched region beyond it. Planner wording: past that point every remaining move would either earn less reach than the donor loses, lose reach under the pessimistic curve, or breach a per-channel cap, so raising intensity changes nothing. Moved weight never falls as intensity rises, which is what lets the marker be found by search.

When less than requested can move, the app says "Headroom used up: X of Y requested reach-pts moved" and why. Intensity therefore moves weight in proportion to the request only until that headroom is used; in Rest of Maharashtra and Karnataka the headroom is small (few channels where Santoor trails), so intensity plateaus early. That is a property of the data, not of the slider.

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
| Low | 0.50 | 0.50 | Receivers saturate sooner, donors lose more per point (`phiDonor` 1.00 for trailing donors). |
| Base | 0.75 | 0.25 | (`phiDonor` 0.75) |
| High | 1.00 | 0.10 | Receivers reach the competitor level at saturation (but still capped at 60% of the gap per channel), donors lose less (`phiDonor` 0.50). |

The low case is also a **gate**: a slice of weight is only moved if its net reach change under the low curve (receivers saturate sooner, donors lose more) is >= 0. So the low band of the net change is never negative (tested for every lever combination).

Layer 2 is suppressed when a region has fewer than 8 active channels. Layer 1 still works there.

### Guardrails enforced in code and tests

- Projected channel reach never exceeds the competitor's reach where Santoor is behind; no uplift is claimed on leading channels.
- Gap closed <= 60% per channel; entry reach on a new channel <= 50% of competitor reach.
- A donor gives <= 50% of its weight and never falls below competitor parity.
- At intensity 0 nothing changes and the Layer 2 delta is exactly 0.
- No NaN or Infinity anywhere, for every intensity 0-100 and threshold 0-100 (step 5), every market and every SCR.

## 7. Data audit flags (flag, never alter)

Reach above 40% on one channel is **not** a hold: 45-55% cumulative reach is plausible for a top Kannada general-entertainment channel (Zee Kannada, Udaya TV, Colors Kannada Cinema, Udaya Music in Karnataka). It only produces an informational note. The data is displayed as supplied. Two hold flags decide only whether the engine may act on a channel; held channels are always MAINTAIN, with the reason shown in the row.

**Observed reach is the evidence; language is never a reason to drop a channel.** Any channel with Santoor or competitor reach >= 1.0% in the market/SCR is in scope whatever its language. Language is checked only below that bar and only produces an informational note (it never holds a channel). Typical languages per market: Karnataka = Kannada, Telugu, Tamil, Hindi, English (Bengaluru and the border districts watch Telugu and Tamil heavily); Maharashtra = Marathi, Hindi, English, with Gujarati spillover; UP = Hindi, Urdu, Bhojpuri, English. The name patterns live in `dataAudit.ts`.

| Flag | Rule | Why |
|---|---|---|
| `NO_COMPETITOR_REF` | Santoor reach > 0 and competitor reach < 0.5. | The 999 index sentinel, or an index computed on a near-zero denominator (for example 733 on 0.44 vs 0.06). Lead cannot be assessed. The table shows the index as "n/a". |
| `IMPOSSIBLE_REACH` | Santoor or competitor reach above 100% on one channel. | Cannot be real. Nothing in the current data triggers it. |

In Karnataka Overall, 17 Telugu/Tamil/Marathi channels that an earlier version held on language alone (for example Gemini Movies 5.7%, Gemini TV 5.0%, Star Maa Movies 5.8%, Zee Cinemalu 3.6%, STAR Maa 3.3%) are now in scope. Those with competitor reach under 0.5 (for example Star Maa Movies) are still held by `NO_COMPETITOR_REF`, which is a data-quality rule, not a language rule. In UP and Maharashtra no in-scope channel was ever held on language.

The table INDEX column shows `n/a` where competitor reach is under 0.5, instead of printing 999.

## 8. What the tool does NOT claim

- It is not a forecast, a media plan, a buy list or an optimiser of spend. It has no spend data.
- Reach-points are not audience reach. Overlap between channels is unknown and no deduplication is attempted.
- It does not know the cost of a reach-point on any channel; "weight" is a proxy equal to observed reach.
- The response-curve shape is an assumption (concave and saturating). The low/base/high range shows how much the answer depends on that assumption; it is not a confidence interval.
- The average reach gap card is a simple unweighted average over channels, as in the original tool. Its scenario value is modelled on the base curve.
- Karnataka is an ATC market in the source file, but the engine uses the reach and gap fields exactly as in the other markets. ATC index is shown as observed and is not modelled.
- Timeband figures are synthetic sample data and are hidden unless the URL has `?debug=1`.
- The default threshold is **30** (top 30% of Santoor channels frozen), not 70. At 70, Rest of Maharashtra produces no defensible move (protected channels hold 88% of the weight and the few unprotected leaders cannot fund the two near-parity receivers); UP and Karnataka move only a little. At 30 every Overall SCR shows a plan, still small. The meaning of the threshold is unchanged. Rest of Maharashtra's useful intensity range stays about 2% because only two channels trail by 0.5+ pts and one white-space channel qualifies; Sangeet Marathi (10.7%) and ABP Majha (4.8%) have no competitor reach and are held by `NO_COMPETITOR_REF`.

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
| Min gap to INCREASE | 0.5 pt (`MIN_GAP_TO_ACT`; the UI text reads it from the code) |
| White-space rule | competitor >= 2.0, share >= 1.0 |
| Min competitor reference | 0.5 |
| Max cut per donor | 50% of its modelled weight |
| Max gap closed per channel | 60% |
| Entry cap | 50% of competitor reach |
| Min entry reach (new channel) | 0.5 reach-points |
| Benefit rule (gain / loss) | 1.0x, plus low-case net >= 0 on every slice |
| Entry friction / reference saturation | 0.5 / 0.6 |
| Slices | 200 |
| Layer 2 minimum active channels | 8 |
| Bands (`phi`, `eta`, `phiDonor`) | low (0.50, 0.50, 1.00), base (0.75, 0.25, 0.75), high (1.00, 0.10, 0.50) |
