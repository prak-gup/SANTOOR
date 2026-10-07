// ============================================================
// LIVE-LEVER SCENARIO ENGINE (pure, no React)
// See METHODOLOGY.md for definitions, formulas and what this does NOT claim.
//
// Two layers:
//   Layer 1 — decision counts that follow directly from the observed data and the two levers.
//   Layer 2 — an indicative, modelled projection on touched channels only (low / base / high).
//
// Units: "weight" and "reach-points" are the same thing here. A channel's weight is its
// observed Santoor reach (reach %, treated as reach-points). Reach-points are DUPLICATED
// across channels; they are never summed into an audience reach %.
// ============================================================

import { filterRelevantChannels } from './optimization';
import type { ChannelRecord } from './optimization';
import { auditChannels, MIN_COMP_REF } from './dataAudit';
import type { AuditFlag, MarketKey } from './dataAudit';

export type Action = 'ADD' | 'INCREASE' | 'MAINTAIN' | 'DECREASE';
export type Priority = 'HIGH' | 'MEDIUM' | 'LOW';
export type BandName = 'low' | 'base' | 'high';

export interface Levers {
  /** 0-100: % of unprotected reach-point weight to reallocate. */
  intensity: number;
  /** 0-100: top X% of Santoor channels (by reach) are frozen before any action rule. */
  threshold: number;
}

export const DEFAULT_LEVERS: Levers = { intensity: 15, threshold: 30 };

export const MODEL_PARAMS = {
  /** Behind channels need at least this reach gap (pts) to be a receiver. */
  MIN_GAP_TO_ACT: 0.5,
  /** White-space (ADD) rule, unchanged from the original filter: competitor reach and channel share. */
  ADD_MIN_COMP_REACH: 2.0,
  ADD_MIN_SHARE: 1.0,
  /** A donor can give up at most this fraction of its own weight. */
  MAX_CUT_FRACTION: 0.5,
  /** Projected gap closed on any one channel never exceeds this fraction of its gap. */
  MAX_GAP_CLOSED: 0.6,
  /** Entry reach on an ADD channel never exceeds this fraction of competitor reach. */
  ADD_CAP_OF_COMP: 0.5,
  /** Only make a move whose net reach change is >= 0 under the pessimistic (low) curve. Tests switch it off to exercise the caps. */
  REQUIRE_LOW_CASE_NET: true,
  /** A move happens only if the receiver returns at least this multiple of what the donor gives up. */
  GAIN_OVER_LOSS: 1.0,
  /** A new channel is only recommended if it can earn at least this much reach (reach %, base curve). */
  MIN_ENTRY_REACH: 0.5,
  /** A new channel converts weight to reach at this fraction of an established channel's rate. */
  ENTRY_FRICTION: 0.5,
  /** Saturation point (fraction of ceiling) at which a new channel earns the roster-average yield. */
  ENTRY_U0: 0.6,
  /** Greedy water-filling granularity: unprotected weight is moved in 1/STEPS slices. */
  STEPS: 200,
  /** Layer 2 is suppressed when fewer active (reach > 0) channels than this. */
  MIN_ACTIVE_FOR_LAYER2: 8,
  /**
   * Curve-shape sensitivity.
   * phi: share of the competitor gap that is attainable at saturation (receivers).
   * eta: headroom above today's reach at saturation (donors that lead); more headroom = steeper loss.
   * phiDonor: same idea for donors that trail (share of their gap that extra weight could still win).
   * Low case = receivers saturate sooner AND donors lose more; high case = the reverse.
   */
  BANDS: {
    low: { phi: 0.5, eta: 0.5, phiDonor: 1.0 },
    base: { phi: 0.75, eta: 0.25, phiDonor: 0.75 },
    high: { phi: 1.0, eta: 0.1, phiDonor: 0.5 },
  } as Record<BandName, { phi: number; eta: number; phiDonor: number }>,
};

const P = MODEL_PARAMS;
const EPS = 1e-9;

// ------------------------------------------------------------
// Response curves: R(w) = Rmax * (1 - exp(-k w))
// ------------------------------------------------------------
interface Curve {
  rmax: number;
  k: number;
  /** weight at the observed operating point */
  w0: number;
}

const resp = (c: Curve, w: number): number => c.rmax * (1 - Math.exp(-c.k * w));
const marginal = (c: Curve, w: number): number => c.k * c.rmax * Math.exp(-c.k * w);

/** Curve through the observed point (w = r, R = r) with ceiling rmax > r. */
function observedCurve(r: number, rmax: number): Curve {
  return { rmax, k: -Math.log(1 - r / rmax) / r, w0: r };
}

/** Curve for a channel Santoor is not on: starts at (0, 0), ceiling rmax, damped by entry friction. */
function entryCurve(rmax: number): Curve {
  const wRef = P.ENTRY_U0 * rmax;
  return { rmax, k: (P.ENTRY_FRICTION * -Math.log(1 - P.ENTRY_U0)) / wRef, w0: 0 };
}

const receiverCeiling = (r: number, c: number, phi: number) => r + phi * (c - r);
const donorCeiling = (r: number, eta: number) => r * (1 + eta);
const entryCeiling = (c: number, phi: number) => P.ADD_CAP_OF_COMP * phi * c;

// ------------------------------------------------------------
// Types
// ------------------------------------------------------------
export interface BandValues {
  low: number;
  base: number;
  high: number;
}

export interface ChannelOutcome {
  channel: string;
  action: Action;
  priority: Priority;
  reason: string;
  isProtected: boolean;
  /** Audit flags that make the engine hold this channel. */
  flags: AuditFlag[];
  reach: number;
  competitorReach: number;
  competitorName: string;
  /** Reach-points added (+) or removed (-). 0 when held. */
  weightDelta: number;
  /** Projected channel reach under each curve shape; null when the channel is untouched. */
  projected: BandValues | null;
}

export interface Layer2 {
  /** Net change in duplicated reach-points on touched channels. */
  netReachPoints: BandValues;
  gainReachPoints: BandValues;
  lossReachPoints: BandValues;
  /** Share of the competitor gap closed, on receiving channels only (0-1). */
  gapClosedShare: BandValues;
  /** Reach-points lost on donor channels as a share of those channels' current reach-points (0-1). */
  donorReachLossShare: BandValues;
  touchedChannels: number;
}

export interface ScenarioResult {
  levers: Levers;
  eligibleCount: number;
  activeCount: number;
  whitespaceCount: number;
  protectedSet: Set<string>;
  protectedCount: number;
  /** Share of roster reach-point weight held by protected channels (0-1). */
  protectedWeightShare: number;
  counts: Record<Action, number>;
  highPriority: number;
  /** (ADD + INCREASE + DECREASE) / eligible, 0-1. */
  interventionRate: number;
  rosterWeight: number;
  unprotectedWeight: number;
  requestedWeight: number;
  movedWeight: number;
  /** movedWeight as a share of unprotected weight / of roster weight, 0-1. */
  movedShareUnprotected: number;
  movedShareRoster: number;
  /** True when the donor pool or the net-benefit rule stopped the move before the requested intensity. */
  limitedBelowRequest: boolean;
  /** Plain-language explanation when less moves than the sliders ask for (or nothing moves). */
  notice: string | null;
  outcomes: Map<string, ChannelOutcome>;
  baseline: { active: number; whitespace: number; avgGap: number };
  /** Scenario counts are exact; avgGap is modelled (base curve) on the same active set. */
  scenario: { active: number; whitespace: number; avgGap: number };
  layer2: Layer2 | null;
  layer2SuppressedReason: string | null;
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------
const COMPETITOR_FIELDS: Array<[keyof ChannelRecord, string]> = [
  ['godrejReach', 'Godrej'],
  ['luxReach', 'Lux'],
  ['lifebuoyReach', 'Lifebuoy'],
  ['mysore_sandalReach', 'Mysore Sandal'],
];

export function topCompetitorName(ch: ChannelRecord): string {
  let best = '';
  let bestVal = 0;
  for (const [field, name] of COMPETITOR_FIELDS) {
    const v = (ch[field] as number | undefined) ?? 0;
    if (v > bestVal) {
      bestVal = v;
      best = name;
    }
  }
  return best || 'best competitor';
}

const f1 = (n: number) => n.toFixed(1);
const idx = (ch: ChannelRecord) =>
  ch.maxCompReach >= MIN_COMP_REF ? String(Math.round((ch.santoorReach / ch.maxCompReach) * 100)) : 'n/a';
const fmtDelta = (d: number) => (Math.abs(d) < 0.05 ? '<0.1' : f1(Math.abs(d)));

/** Stable ranking: reach desc, then channel share (tie-breaker only), then name. */
function byReachDesc(a: ChannelRecord, b: ChannelRecord): number {
  if (b.santoorReach !== a.santoorReach) return b.santoorReach - a.santoorReach;
  if (b.channelShare !== a.channelShare) return b.channelShare - a.channelShare;
  return a.channel < b.channel ? -1 : a.channel > b.channel ? 1 : 0;
}

/** Channels in scope: the same "actionable" set the table shows, independent of search/genre/sort. */
export function eligibleChannels(all: ChannelRecord[]): ChannelRecord[] {
  return filterRelevantChannels(all, 'actionable') as ChannelRecord[];
}

export function getProtectedSet(eligible: ChannelRecord[], threshold: number): Set<string> {
  const active = eligible.filter(c => c.santoorReach > 0).sort(byReachDesc);
  const cut = Math.min(active.length, Math.max(0, Math.ceil((active.length * threshold) / 100 - EPS)));
  return new Set(active.slice(0, cut).map(c => c.channel));
}

// ------------------------------------------------------------
// Engine
// ------------------------------------------------------------
interface Receiver {
  ch: ChannelRecord;
  kind: 'ADD' | 'INCREASE';
  curve: Curve;
  xMax: number;
  /** ADD only: minimum first allocation so the entry reach reaches MIN_ENTRY_REACH. */
  xMin: number;
  x: number;
  skip: boolean;
}
interface Donor {
  ch: ChannelRecord;
  /** true: Santoor leads (curve has little headroom). false: trails but extra weight earns little. */
  leader: boolean;
  curve: Curve;
  zMax: number;
  z: number;
  /** marginal reach per weight point at the start (base curve), for the reason string. */
  m0: number;
}

export function computeScenario(
  allChannels: ChannelRecord[],
  market: MarketKey,
  levers: Levers
): ScenarioResult {
  const intensity = Math.min(100, Math.max(0, levers.intensity));
  const threshold = Math.min(100, Math.max(0, levers.threshold));

  const eligible = eligibleChannels(allChannels);
  const audits = auditChannels(eligible, market);
  const active = eligible.filter(c => c.santoorReach > 0);
  const protectedSet = getProtectedSet(eligible, threshold);

  const heldFlags = (ch: ChannelRecord) => audits.get(ch.channel)?.flags ?? [];
  const isWhitespace = (ch: ChannelRecord) =>
    ch.santoorReach === 0 && ch.maxCompReach >= P.ADD_MIN_COMP_REACH && ch.channelShare >= P.ADD_MIN_SHARE;

  // ---- roles ------------------------------------------------
  const receivers: Receiver[] = [];
  const donors: Donor[] = [];
  const base = P.BANDS.base;

  for (const ch of eligible) {
    const flags = heldFlags(ch);
    const r = ch.santoorReach;
    const c = ch.maxCompReach;

    if (isWhitespace(ch)) {
      if (flags.includes('REGIONAL_LANGUAGE')) continue;
      const curve = entryCurve(entryCeiling(c, base.phi));
      // practical limit: 90% of the ceiling (the net-benefit rule normally stops earlier)
      const xMax = -Math.log(0.1) / curve.k;
      const xMin = -Math.log(1 - P.MIN_ENTRY_REACH / curve.rmax) / curve.k;
      receivers.push({ ch, kind: 'ADD', curve, xMax, xMin, x: 0, skip: xMin >= xMax });
      continue;
    }
    if (r <= 0 || flags.length > 0 || c < MIN_COMP_REF) continue;

    if (c - r >= P.MIN_GAP_TO_ACT) {
      const curve = observedCurve(r, receiverCeiling(r, c, base.phi));
      const capReach = r + P.MAX_GAP_CLOSED * (c - r);
      const xMax = Math.max(0, -Math.log(1 - capReach / curve.rmax) / curve.k - curve.w0);
      receivers.push({ ch, kind: 'INCREASE', curve, xMax, xMin: 0, x: 0, skip: false });
    }
    // Any unprotected channel can donate; the lowest marginal return gives first.
    if (!protectedSet.has(ch.channel)) {
      if (r >= c) {
        const curve = observedCurve(r, donorCeiling(r, base.eta));
        // a leading donor never falls behind the competitor because of the cut
        const wAtParity = -Math.log(1 - c / curve.rmax) / curve.k;
        donors.push({ ch, leader: true, curve, zMax: Math.max(0, Math.min(P.MAX_CUT_FRACTION * r, r - wAtParity)), z: 0, m0: marginal(curve, r) });
      } else {
        const curve = observedCurve(r, receiverCeiling(r, c, base.phiDonor));
        donors.push({ ch, leader: false, curve, zMax: P.MAX_CUT_FRACTION * r, z: 0, m0: marginal(curve, r) });
      }
    }
  }

  // ---- projections per band (explicit x / z so moves can be checked before they are applied) --
  const recProj = (rc: Receiver, band: BandName, x: number): number => {
    const { phi } = P.BANDS[band];
    const r = rc.ch.santoorReach;
    const c = rc.ch.maxCompReach;
    if (rc.kind === 'ADD') return Math.min(resp(entryCurve(entryCeiling(c, phi)), x), P.ADD_CAP_OF_COMP * c);
    return Math.min(resp(observedCurve(r, receiverCeiling(r, c, phi)), r + x), r + P.MAX_GAP_CLOSED * (c - r));
  };
  const donProj = (d: Donor, band: BandName, z: number): number => {
    const r = d.ch.santoorReach;
    const c = d.ch.maxCompReach;
    const b = P.BANDS[band];
    const curve = d.leader ? observedCurve(r, donorCeiling(r, b.eta)) : observedCurve(r, receiverCeiling(r, c, b.phiDonor));
    return Math.max(0, resp(curve, r - z));
  };

  // ---- weights ---------------------------------------------
  const rosterWeight = active.reduce((s, c) => s + c.santoorReach, 0);
  const unprotectedWeight = active
    .filter(c => !protectedSet.has(c.channel))
    .reduce((s, c) => s + c.santoorReach, 0);
  const protectedWeight = rosterWeight - unprotectedWeight;
  const requestedWeight = (intensity / 100) * unprotectedWeight;

  // ---- greedy water-filling --------------------------------
  // The sequence of moves depends only on (data, threshold). Intensity decides how far along
  // that sequence we go, so a higher intensity always extends a lower one.
  let movedWeight = 0;
  const delta = unprotectedWeight / P.STEPS;
  let remaining = requestedWeight;
  let guard = 0;
  let stopReason: StopReason = 'none';
  const rxBy = new Map(receivers.map(r => [r.ch.channel, r]));
  const pickDonor = (except: ChannelRecord | null): Donor | null => {
    let best: Donor | null = null;
    let bestM = Infinity;
    for (const d of donors) {
      if (d.z >= d.zMax - EPS || d.ch === except) continue;
      if ((rxBy.get(d.ch.channel)?.x ?? 0) > EPS) continue; // already a receiver
      const m = marginal(d.curve, d.curve.w0 - d.z);
      if (m < bestM - EPS || (Math.abs(m - bestM) <= EPS && best && compareDonor(d, best) < 0)) {
        best = d;
        bestM = m;
      }
    }
    return best;
  };
  const donorM = (d: Donor) => marginal(d.curve, d.curve.w0 - d.z);
  const donBy = new Map(donors.map(d => [d.ch.channel, d]));

  while (remaining > EPS && delta > 0 && guard++ < P.STEPS * 6) {
    let rec: Receiver | null = null;
    let recM = -Infinity;
    for (const r of receivers) {
      if (r.skip || r.x >= r.xMax - EPS) continue;
      if ((donBy.get(r.ch.channel)?.z ?? 0) > EPS) continue; // already a donor
      const m = marginal(r.curve, r.curve.w0 + r.x);
      if (m > recM + EPS || (Math.abs(m - recM) <= EPS && rec && compareReceiver(r, rec) < 0)) {
        rec = r;
        recM = m;
      }
    }
    if (!rec) {
      stopReason = 'receivers';
      break;
    }
    const don = pickDonor(rec.ch);
    if (!don) {
      stopReason = 'donors';
      break;
    }
    const donM = donorM(don);
    if (recM < P.GAIN_OVER_LOSS * donM) {
      stopReason = 'benefit';
      break;
    }

    if (rec.kind === 'ADD' && rec.x === 0) {
      // Entry block: a new channel must clear the minimum entry reach, funded from one or more donors.
      const capacity = donors.reduce(
        (sum, d) => (d.ch === rec!.ch || (rxBy.get(d.ch.channel)?.x ?? 0) > EPS ? sum : sum + Math.max(0, d.zMax - d.z)),
        0
      );
      const avgYield = P.MIN_ENTRY_REACH / rec.xMin;
      if (capacity < rec.xMin - EPS || avgYield < P.GAIN_OVER_LOSS * donM) {
        rec.skip = true;
        continue;
      }
      if (remaining < rec.xMin - EPS) {
        stopReason = 'entry';
        break;
      }
      const taken = new Map<Donor, number>();
      let need = rec.xMin;
      while (need > EPS) {
        const d2 = pickDonor(rec.ch);
        if (!d2) break;
        const a = Math.min(delta, need, d2.zMax - d2.z);
        d2.z += a;
        taken.set(d2, (taken.get(d2) ?? 0) + a);
        need -= a;
      }
      // robust under the pessimistic curve: low-case net change must not be negative
      let lossLow = 0;
      for (const [d, a] of taken) lossLow += donProj(d, 'low', d.z - a) - donProj(d, 'low', d.z);
      if (need > EPS || (P.REQUIRE_LOW_CASE_NET && recProj(rec, 'low', rec.xMin) - lossLow < 0)) {
        for (const [d, a] of taken) d.z -= a;
        rec.skip = true;
        continue;
      }
      rec.x = rec.xMin;
      movedWeight += rec.xMin;
      remaining -= rec.xMin;
      continue;
    }

    // Check the full-size slice first, so the verdict does not depend on how much of the request is left.
    const full = Math.min(delta, rec.xMax - rec.x, don.zMax - don.z);
    if (full <= EPS) break;
    const gainLow = recProj(rec, 'low', rec.x + full) - recProj(rec, 'low', rec.x);
    const lossLow = donProj(don, 'low', don.z) - donProj(don, 'low', don.z + full);
    if (P.REQUIRE_LOW_CASE_NET && gainLow - lossLow < 0) {
      stopReason = 'low';
      break;
    }
    const step = Math.min(full, remaining);
    rec.x += step;
    don.z += step;
    movedWeight += step;
    remaining -= step;
  }
  const limitedBelowRequest = remaining > Math.max(EPS, requestedWeight * 1e-6);
  const notice = buildNotice({
    intensity,
    threshold,
    limitedBelowRequest,
    stopReason,
    donorCount: donors.length,
    receiverCount: receivers.length,
    unprotectedWeight,
    requestedWeight,
    movedWeight,
  });

  const projectReceiver = (rc: Receiver, band: BandName): number => recProj(rc, band, rc.x);
  const projectDonor = (d: Donor, band: BandName): number => donProj(d, band, d.z);

  const touchedReceivers = receivers.filter(r => r.x > EPS);
  const touchedDonors = donors.filter(d => d.z > EPS);
  const BANDS: BandName[] = ['low', 'base', 'high'];

  // ---- outcomes --------------------------------------------
  const outcomes = new Map<string, ChannelOutcome>();
  const recByName = new Map(receivers.map(r => [r.ch.channel, r]));
  const donByName = new Map(donors.map(d => [d.ch.channel, d]));
  const rankByName = new Map([...active].sort(byReachDesc).map((c, i) => [c.channel, i + 1]));

  for (const ch of eligible) {
    const flags = heldFlags(ch);
    const prot = protectedSet.has(ch.channel);
    const comp = topCompetitorName(ch);
    const r = ch.santoorReach;
    const c = ch.maxCompReach;
    const rc = recByName.get(ch.channel);
    const dn = donByName.get(ch.channel);

    let action: Action = 'MAINTAIN';
    let priority: Priority = 'LOW';
    let reason = '';
    let weightDelta = 0;
    let projected: BandValues | null = null;

    if (rc && rc.x > EPS) {
      action = rc.kind;
      weightDelta = rc.x;
      projected = bandValues(b => projectReceiver(rc, b));
      if (rc.kind === 'ADD') {
        priority = c > 5 ? 'HIGH' : c > 3 ? 'MEDIUM' : 'LOW';
        reason = `White space: ${comp} at ${f1(c)}%, Santoor absent, share ${f1(ch.channelShare)}% → +${fmtDelta(rc.x)} reach-pts, entry reach ~${f1(projected.base)}% (capped at ${Math.round(P.ADD_CAP_OF_COMP * 100)}% of competitor)`;
      } else {
        const gap = r - c;
        priority = gap <= -5 ? 'HIGH' : gap <= -2 ? 'MEDIUM' : 'LOW';
        reason = `Behind ${comp} by ${f1(-gap)} pts, index ${idx(ch)} → INCREASE +${fmtDelta(rc.x)} reach-pts, reach ${f1(r)}% → ${f1(projected.base)}%`;
      }
    } else if (dn && dn.z > EPS) {
      action = 'DECREASE';
      weightDelta = -dn.z;
      projected = bandValues(b => projectDonor(dn, b));
      const cut = `DECREASE -${fmtDelta(dn.z)} reach-pts (${Math.round((dn.z / r) * 100)}% of its weight), reach ${f1(r)}% → ${f1(projected.base)}%`;
      reason = dn.leader
        ? `Leads ${comp} by ${f1(r - c)} pts, index ${idx(ch)}, not protected → ${cut}`
        : `Low return: reach ${f1(r)}% vs ${comp} ${f1(c)}% (index ${idx(ch)}), each reach-point of weight here earns only ~${dn.m0.toFixed(1)} → ${cut}`;
    } else {
      reason = maintainReason({
        ch,
        comp,
        prot,
        threshold,
        flags,
        auditNotes: audits.get(ch.channel)?.notes ?? [],
        rank: rankByName.get(ch.channel),
        activeCount: active.length,
        isReceiver: !!rc,
        isDonor: !!dn,
        isWhitespaceRegional: isWhitespace(ch) && flags.includes('REGIONAL_LANGUAGE'),
        intensity,
        anyDonor: donors.length > 0,
      });
    }

    outcomes.set(ch.channel, {
      channel: ch.channel,
      action,
      priority,
      reason,
      isProtected: prot,
      flags,
      reach: r,
      competitorReach: c,
      competitorName: comp,
      weightDelta,
      projected,
    });
  }

  // ---- counts ----------------------------------------------
  const counts: Record<Action, number> = { ADD: 0, INCREASE: 0, MAINTAIN: 0, DECREASE: 0 };
  let highPriority = 0;
  for (const o of outcomes.values()) {
    counts[o.action]++;
    if (o.priority === 'HIGH' && o.action !== 'MAINTAIN') highPriority++;
  }

  // ---- Layer 2 ---------------------------------------------
  let layer2: Layer2 | null = null;
  let layer2SuppressedReason: string | null = null;
  if (active.length < P.MIN_ACTIVE_FOR_LAYER2) {
    layer2SuppressedReason = `Only ${active.length} active channels in this region (minimum ${P.MIN_ACTIVE_FOR_LAYER2}); a modelled projection would not be defensible.`;
  } else {
    const gain = bandValues(() => 0);
    const loss = bandValues(() => 0);
    const gapOpen = { v: 0 };
    const donorBase = { v: 0 };
    const gapGain = bandValues(() => 0);
    const donorLoss = bandValues(() => 0);
    for (const rc of touchedReceivers) {
      gapOpen.v += rc.ch.maxCompReach - rc.ch.santoorReach;
      for (const b of BANDS) {
        const g = projectReceiver(rc, b) - rc.ch.santoorReach;
        gain[b] += g;
        gapGain[b] += g;
      }
    }
    for (const d of touchedDonors) {
      donorBase.v += d.ch.santoorReach;
      for (const b of BANDS) {
        const l = d.ch.santoorReach - projectDonor(d, b);
        loss[b] += l;
        donorLoss[b] += l;
      }
    }
    layer2 = {
      gainReachPoints: gain,
      lossReachPoints: loss,
      netReachPoints: bandValues(b => gain[b] - loss[b]),
      gapClosedShare: bandValues(b => (gapOpen.v > 0 ? Math.min(P.MAX_GAP_CLOSED, gapGain[b] / gapOpen.v) : 0)),
      donorReachLossShare: bandValues(b => (donorBase.v > 0 ? donorLoss[b] / donorBase.v : 0)),
      touchedChannels: touchedReceivers.length + touchedDonors.length,
    };
  }

  // ---- baseline vs scenario --------------------------------
  const baselineGapSum = active.reduce((s, c) => s + c.gap, 0);
  const baselineAvgGap = active.length ? baselineGapSum / active.length : 0;
  const whitespaceCount = eligible.filter(isWhitespace).length;
  let scenarioGapSum = baselineGapSum;
  for (const rc of touchedReceivers) {
    if (rc.kind === 'INCREASE') scenarioGapSum += projectReceiver(rc, 'base') - rc.ch.santoorReach;
  }
  for (const d of touchedDonors) scenarioGapSum -= d.ch.santoorReach - projectDonor(d, 'base');

  return {
    levers: { intensity, threshold },
    eligibleCount: eligible.length,
    activeCount: active.length,
    whitespaceCount,
    protectedSet,
    protectedCount: protectedSet.size,
    protectedWeightShare: rosterWeight > 0 ? protectedWeight / rosterWeight : 0,
    counts,
    highPriority,
    interventionRate: eligible.length ? (counts.ADD + counts.INCREASE + counts.DECREASE) / eligible.length : 0,
    rosterWeight,
    unprotectedWeight,
    requestedWeight,
    movedWeight,
    movedShareUnprotected: unprotectedWeight > 0 ? movedWeight / unprotectedWeight : 0,
    movedShareRoster: rosterWeight > 0 ? movedWeight / rosterWeight : 0,
    limitedBelowRequest,
    notice,
    outcomes,
    baseline: { active: active.length, whitespace: whitespaceCount, avgGap: baselineAvgGap },
    scenario: {
      active: active.length + counts.ADD,
      whitespace: whitespaceCount - counts.ADD,
      avgGap: active.length ? scenarioGapSum / active.length : 0,
    },
    layer2,
    layer2SuppressedReason,
  };
}

type StopReason = 'none' | 'donors' | 'benefit' | 'receivers' | 'entry' | 'low';

interface NoticeCtx {
  intensity: number;
  threshold: number;
  limitedBelowRequest: boolean;
  stopReason: StopReason;
  donorCount: number;
  receiverCount: number;
  unprotectedWeight: number;
  requestedWeight: number;
  movedWeight: number;
}

function buildNotice(x: NoticeCtx): string | null {
  if (x.intensity === 0) return null;
  if (x.donorCount === 0) {
    return `Nothing can move: the ${x.threshold}% threshold protects every active channel, so there is no donor weight to release. Lower the threshold.`;
  }
  if (x.receiverCount === 0) {
    return 'Nothing can move: no behind or white-space channel meets the action rules.';
  }
  if (!x.limitedBelowRequest) return null;
  const asked = `Headroom used up: ${f1(x.movedWeight)} of ${f1(x.requestedWeight)} requested reach-pts moved`;
  if (x.stopReason === 'benefit') {
    return `${asked}. Beyond this a receiving channel would earn no more reach than the cheapest donor gives up.`;
  }
  if (x.stopReason === 'low') {
    return `${asked}. The next move would lose reach under the pessimistic (low) curve, so it is not recommended.`;
  }
  if (x.stopReason === 'entry') {
    return `${asked}: the next step is a new channel, which needs at least ${f1(P.MIN_ENTRY_REACH)} reach-pts of entry weight to be worth recommending.`;
  }
  if (x.stopReason === 'donors') {
    return `${asked}: every donor has given the maximum 50% of its weight.`;
  }
  return `${asked}: every receiving channel has reached its cap (60% of gap, or 50% of competitor reach on new channels).`;
}

function bandValues(fn: (b: BandName) => number): BandValues {
  return { low: fn('low'), base: fn('base'), high: fn('high') };
}

function compareReceiver(a: Receiver, b: Receiver): number {
  const ga = a.ch.maxCompReach - a.ch.santoorReach;
  const gb = b.ch.maxCompReach - b.ch.santoorReach;
  if (gb !== ga) return gb - ga; // larger gap first
  if (b.ch.channelShare !== a.ch.channelShare) return b.ch.channelShare - a.ch.channelShare;
  return a.ch.channel < b.ch.channel ? -1 : 1;
}

function compareDonor(a: Donor, b: Donor): number {
  const ia = a.ch.santoorReach / a.ch.maxCompReach;
  const ib = b.ch.santoorReach / b.ch.maxCompReach;
  if (ib !== ia) return ib - ia; // strongest lead first
  if (b.ch.channelShare !== a.ch.channelShare) return b.ch.channelShare - a.ch.channelShare;
  return a.ch.channel < b.ch.channel ? -1 : 1;
}

interface MaintainCtx {
  ch: ChannelRecord;
  comp: string;
  prot: boolean;
  threshold: number;
  flags: AuditFlag[];
  auditNotes: string[];
  rank: number | undefined;
  activeCount: number;
  isReceiver: boolean;
  isDonor: boolean;
  isWhitespaceRegional: boolean;
  intensity: number;
  anyDonor: boolean;
}

function maintainReason(x: MaintainCtx): string {
  const { ch, comp } = x;
  const r = ch.santoorReach;
  const c = ch.maxCompReach;
  const gapTxt = c >= MIN_COMP_REF ? (r >= c ? `leads ${comp} by ${f1(r - c)} pts` : `behind ${comp} by ${f1(c - r)} pts`) : '';
  if (x.flags.length > 0 || x.isWhitespaceRegional) {
    const note = x.auditNotes.length ? x.auditNotes.join('; ') : 'data flag';
    return `Held, data flag: ${note}${x.prot ? ' (also in protected top ' + x.threshold + '%)' : ''}`;
  }
  if (x.prot) {
    return `Protected: rank ${x.rank} of ${x.activeCount} by reach, inside top ${x.threshold}%${gapTxt ? '; ' + gapTxt + ', index ' + idx(ch) : ''}${x.isReceiver ? '; behind but no weight reached it at this intensity' : ''}`;
  }
  if (x.isReceiver) {
    const why =
      x.intensity === 0
        ? 'intensity is 0'
        : x.anyDonor
          ? 'extra weight here would earn less reach than the donor channels give up'
          : 'no unprotected channel can give weight';
    return ch.santoorReach === 0
      ? `White space: ${comp} at ${f1(c)}%, Santoor absent, share ${f1(ch.channelShare)}% → no change (${why})`
      : `Behind ${comp} by ${f1(c - r)} pts, index ${idx(ch)} → no change (${why})`;
  }
  if (x.isDonor) {
    return `Leads ${comp} by ${f1(r - c)} pts, index ${idx(ch)}; available as donor → not trimmed at this intensity`;
  }
  if (c >= MIN_COMP_REF && c - r > 0 && c - r < P.MIN_GAP_TO_ACT) {
    return `Behind ${comp} by ${f1(c - r)} pts, index ${idx(ch)} → gap under the ${P.MIN_GAP_TO_ACT.toFixed(1)}-pt action floor, hold`;
  }
  return gapTxt ? `${gapTxt[0].toUpperCase()}${gapTxt.slice(1)}, index ${idx(ch)} → hold` : 'No action';
}
