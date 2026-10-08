import { beforeAll, describe, expect, it } from 'vitest';
import { computeScenario, computeUsefulIntensity, DEFAULT_LEVERS, eligibleChannels, getProtectedSet, MODEL_PARAMS } from './scenario';
import type { ScenarioResult } from './scenario';
import { channelsFor, MARKET_KEYS, scrsFor } from './marketData';
import type { MarketKey } from './dataAudit';
import { auditChannel, detectLanguage } from './dataAudit';
import type { ChannelRecord } from './optimization';

const STEPS = Array.from({ length: 21 }, (_, i) => i * 5);
const TOL = 1e-9;

interface Cell {
  market: MarketKey;
  scr: string;
  channels: ChannelRecord[];
  grid: Map<string, ScenarioResult>;
}
const key = (i: number, t: number) => `${i}|${t}`;
const cells: Cell[] = [];

beforeAll(() => {
  for (const market of MARKET_KEYS) {
    for (const scr of scrsFor(market)) {
      const channels = channelsFor(market, scr);
      const grid = new Map<string, ScenarioResult>();
      for (const i of STEPS) for (const t of STEPS) grid.set(key(i, t), computeScenario(channels, market, { intensity: i, threshold: t }));
      cells.push({ market, scr, channels, grid });
    }
  }
}, 120_000);

function ch(over: Partial<ChannelRecord> & { channel: string }): ChannelRecord {
  const santoorReach = over.santoorReach ?? 0;
  const maxCompReach = over.maxCompReach ?? 0;
  return {
    genre: 'Entertainment',
    santoorReach,
    maxCompReach,
    gap: santoorReach - maxCompReach,
    channelShare: 2,
    indexVsBaseline: 100,
    indexVsCompetition: maxCompReach > 0 ? (santoorReach / maxCompReach) * 100 : 0,
    godrejReach: maxCompReach,
    ...over,
  };
}

/** Ten-channel synthetic region: a few strong leaders, several laggards, one white-space channel. */
function syntheticRegion(): ChannelRecord[] {
  return [
    ch({ channel: 'Lead A', santoorReach: 12, maxCompReach: 4 }),
    ch({ channel: 'Lead B', santoorReach: 9, maxCompReach: 3 }),
    ch({ channel: 'Lead C', santoorReach: 6, maxCompReach: 2.5 }),
    ch({ channel: 'Lead D', santoorReach: 5, maxCompReach: 2 }),
    ch({ channel: 'Mid E', santoorReach: 4, maxCompReach: 4.2 }),
    ch({ channel: 'Lag F', santoorReach: 3, maxCompReach: 10 }),
    ch({ channel: 'Lag G', santoorReach: 2.5, maxCompReach: 9 }),
    ch({ channel: 'Lag H', santoorReach: 2, maxCompReach: 8 }),
    ch({ channel: 'Lag I', santoorReach: 1.6, maxCompReach: 7 }),
    ch({ channel: 'White J', santoorReach: 0, maxCompReach: 9, channelShare: 3 }),
  ];
}

function numbers(value: unknown, path: string, out: Array<[string, number]> = []): Array<[string, number]> {
  if (typeof value === 'number') out.push([path, value]);
  else if (value instanceof Map) value.forEach((v, k) => numbers(v, `${path}[${String(k)}]`, out));
  else if (value instanceof Set) return out;
  else if (Array.isArray(value)) value.forEach((v, i) => numbers(v, `${path}[${i}]`, out));
  else if (value && typeof value === 'object') Object.entries(value).forEach(([k, v]) => numbers(v, `${path}.${k}`, out));
  return out;
}

describe('invariants over every intensity x threshold x market x SCR', () => {
  it('covers 3 markets, 17 SCRs and 441 lever combinations each', () => {
    expect(cells.length).toBe(17);
    for (const c of cells) expect(c.grid.size).toBe(441);
  });

  it('gives each in-scope channel exactly one action and the counts reconcile', () => {
    for (const c of cells) {
      const eligible = eligibleChannels(c.channels).map(x => x.channel).sort();
      for (const s of c.grid.values()) {
        expect([...s.outcomes.keys()].sort()).toEqual(eligible);
        for (const o of s.outcomes.values()) expect(['ADD', 'INCREASE', 'MAINTAIN', 'DECREASE']).toContain(o.action);
        const sum = s.counts.ADD + s.counts.INCREASE + s.counts.MAINTAIN + s.counts.DECREASE;
        expect(sum).toBe(s.eligibleCount);
        expect(s.eligibleCount).toBe(eligible.length);
        expect(s.interventionRate).toBeCloseTo((s.counts.ADD + s.counts.INCREASE + s.counts.DECREASE) / s.eligibleCount, 12);
        expect(s.highPriority).toBeLessThanOrEqual(s.counts.ADD + s.counts.INCREASE + s.counts.DECREASE);
      }
    }
  });

  it('does nothing at intensity 0, with zero projected delta', () => {
    for (const c of cells) {
      for (const t of STEPS) {
        const s = c.grid.get(key(0, t))!;
        expect(s.counts.ADD + s.counts.INCREASE + s.counts.DECREASE).toBe(0);
        expect(s.movedWeight).toBe(0);
        expect(s.highPriority).toBe(0);
        if (s.layer2) {
          for (const band of ['low', 'base', 'high'] as const) {
            expect(s.layer2.netReachPoints[band]).toBe(0);
            expect(s.layer2.gainReachPoints[band]).toBe(0);
            expect(s.layer2.lossReachPoints[band]).toBe(0);
          }
        }
        expect(s.scenario.active).toBe(s.baseline.active);
        expect(s.scenario.avgGap).toBeCloseTo(s.baseline.avgGap, 9);
      }
    }
  });

  it('moves more weight and touches more channels as intensity rises (fixed threshold)', () => {
    for (const c of cells) {
      for (const t of STEPS) {
        let prevMoved = -1;
        let prevTouched = -1;
        for (const i of STEPS) {
          const s = c.grid.get(key(i, t))!;
          const touched = s.counts.ADD + s.counts.INCREASE + s.counts.DECREASE;
          expect(s.movedWeight).toBeGreaterThanOrEqual(prevMoved - TOL);
          expect(touched).toBeGreaterThanOrEqual(prevTouched);
          prevMoved = s.movedWeight;
          prevTouched = touched;
        }
      }
    }
  });

  it('keeps every earlier recommendation direction when intensity rises', () => {
    for (const c of cells) {
      for (const t of STEPS) {
        for (let k = 1; k < STEPS.length; k++) {
          const lo = c.grid.get(key(STEPS[k - 1], t))!;
          const hi = c.grid.get(key(STEPS[k], t))!;
          for (const [name, o] of lo.outcomes) {
            if (o.action !== 'MAINTAIN') expect(hi.outcomes.get(name)!.action).toBe(o.action);
          }
        }
      }
    }
  });

  it('protects a superset of channels as the threshold rises (fixed intensity)', () => {
    for (const c of cells) {
      for (const i of STEPS) {
        for (let k = 1; k < STEPS.length; k++) {
          const lo = c.grid.get(key(i, STEPS[k - 1]))!.protectedSet;
          const hi = c.grid.get(key(i, STEPS[k]))!.protectedSet;
          for (const name of lo) expect(hi.has(name)).toBe(true);
        }
      }
      expect(c.grid.get(key(0, 0))!.protectedCount).toBe(0);
      expect(c.grid.get(key(0, 100))!.protectedCount).toBe(c.grid.get(key(0, 100))!.activeCount);
    }
  });

  it('never decreases a protected channel, and never moves weight at threshold 100', () => {
    for (const c of cells) {
      for (const s of c.grid.values()) {
        for (const o of s.outcomes.values()) {
          if (s.protectedSet.has(o.channel)) {
            expect(o.isProtected).toBe(true);
            expect(o.action).not.toBe('DECREASE');
          }
        }
        if (s.levers.threshold === 100) expect(s.counts.DECREASE).toBe(0);
        if (s.levers.threshold === 100) expect(s.movedWeight).toBe(0);
      }
    }
  });

  it('respects the per-channel sanity bounds in every band', () => {
    const { MAX_GAP_CLOSED, ADD_CAP_OF_COMP, MAX_CUT_FRACTION } = MODEL_PARAMS;
    for (const c of cells) {
      for (const s of c.grid.values()) {
        for (const o of s.outcomes.values()) {
          if (!o.projected) continue;
          const r = o.reach;
          const comp = o.competitorReach;
          for (const band of ['low', 'base', 'high'] as const) {
            const p = o.projected[band];
            if (o.action === 'INCREASE') {
              expect(r).toBeLessThan(comp);
              expect(p).toBeLessThanOrEqual(comp + TOL);
              expect(p).toBeGreaterThanOrEqual(r - TOL);
              expect((p - r) / (comp - r)).toBeLessThanOrEqual(MAX_GAP_CLOSED + 1e-7);
            } else if (o.action === 'ADD') {
              expect(r).toBe(0);
              expect(p).toBeGreaterThan(0);
              expect(p).toBeLessThanOrEqual(ADD_CAP_OF_COMP * comp + TOL);
            } else if (o.action === 'DECREASE') {
              expect(p).toBeLessThanOrEqual(r + TOL);
              expect(p).toBeGreaterThanOrEqual(0);
            }
          }
          if (o.action === 'DECREASE') {
            expect(-o.weightDelta).toBeLessThanOrEqual(MAX_CUT_FRACTION * r + 1e-7);
            expect(s.protectedSet.has(o.channel)).toBe(false); // only unprotected channels donate
            // a leader is never cut below competitor parity, in ANY displayed band
            if (r >= comp) for (const band of ['low', 'base', 'high'] as const) expect(o.projected[band]).toBeGreaterThanOrEqual(comp - 1e-6);
          }
        }
      }
    }
  });

  it('conserves weight: what receivers gain equals what donors give up', () => {
    for (const c of cells) {
      for (const s of c.grid.values()) {
        let up = 0;
        let down = 0;
        for (const o of s.outcomes.values()) {
          if (o.weightDelta > 0) up += o.weightDelta;
          else down -= o.weightDelta;
        }
        expect(up).toBeCloseTo(down, 7);
        expect(up).toBeCloseTo(s.movedWeight, 7);
        expect(s.movedWeight).toBeLessThanOrEqual(s.requestedWeight + 1e-7);
        expect(s.movedShareUnprotected).toBeLessThanOrEqual(s.levers.intensity / 100 + 1e-9);
      }
    }
  });

  it('contains no NaN or Infinity anywhere in the result', () => {
    for (const c of cells) {
      for (const s of c.grid.values()) {
        for (const [path, n] of numbers(s, 'result')) {
          if (!Number.isFinite(n)) throw new Error(`${c.market}/${c.scr} i=${s.levers.intensity} t=${s.levers.threshold}: ${path} = ${n}`);
        }
      }
    }
  });

  it('writes a reason with numbers for every channel', () => {
    for (const c of cells) {
      const s = c.grid.get(key(DEFAULT_LEVERS.intensity, DEFAULT_LEVERS.threshold))!;
      for (const o of s.outcomes.values()) {
        expect(o.reason.length).toBeGreaterThan(10);
        expect(o.reason).not.toMatch(/NaN|undefined|Infinity/);
        if (o.action !== 'MAINTAIN') expect(o.reason, `${c.scr} ${o.channel}`).toMatch(/\d/);
      }
    }
  });
});

describe('default levers (intensity 15, threshold 30) are visible and modest', () => {
  it('keeps the Layer 2 headline small for every market and SCR', () => {
    for (const c of cells) {
      const s = c.grid.get(key(DEFAULT_LEVERS.intensity, DEFAULT_LEVERS.threshold))!;
      expect(s.layer2).not.toBeNull();
      const l2 = s.layer2!;
      expect(l2.gainReachPoints.base).toBeLessThanOrEqual(0.07 * s.rosterWeight);
      expect(Math.abs(l2.netReachPoints.base)).toBeLessThan(0.05 * s.rosterWeight);
      expect(l2.gapClosedShare.high).toBeLessThanOrEqual(MODEL_PARAMS.MAX_GAP_CLOSED);
      expect(s.movedShareRoster).toBeLessThanOrEqual(0.08);
    }
  });

  it('shows a visible plan in every Overall SCR at the default levers', () => {
    for (const c of cells.filter(x => x.scr.endsWith('Overall'))) {
      const s = c.grid.get(key(DEFAULT_LEVERS.intensity, DEFAULT_LEVERS.threshold))!;
      if (s.counts.ADD + s.counts.INCREASE + s.counts.DECREASE === 0) {
        // only allowed when the whole plan is one indivisible new-channel entry that needs more weight, and the notice says so
        expect(s.notice, `${c.scr} empty default plan`).toMatch(/Stopped:|Nothing can move/);
        continue;
      }
      expect(s.movedWeight).toBeGreaterThan(0);
    }
  });
});

describe('intensity is alive', () => {
  it('is elastic: UP and Karnataka move strictly more weight at every 20-point step', () => {
    for (const scr of ['UP Overall', 'Karnataka Overall']) {
      const c = cells.find(x => x.scr === scr)!;
      const moved = [10, 30, 50, 70, 90].map(i => c.grid.get(key(i, DEFAULT_LEVERS.threshold))!.movedWeight);
      for (let k = 1; k < moved.length; k++) expect(moved[k], `${scr} step ${k}`).toBeGreaterThan(moved[k - 1] + 1e-9);
    }
  });

  it('moves strictly more weight from intensity 10 to 30 to 50 unless the notice reports used-up headroom', () => {
    for (const c of cells.filter(x => x.scr.endsWith('Overall'))) {
      for (const t of [30, 70]) {
        const [a, b, d] = [10, 30, 50].map(i => c.grid.get(key(i, t))!);
        for (const [lo, hi] of [[a, b], [b, d]] as const) {
          if (hi.movedWeight > lo.movedWeight + 1e-9) continue;
          // not strictly more: only allowed if the lower setting already used all headroom and says so with a number
          expect(lo.notice, `${c.scr} t=${t} i=${lo.levers.intensity} flat without explanation`).toMatch(/Headroom used up: [\d.]+ of [\d.]+|Stopped:|Nothing can move/);
          expect(hi.notice).toMatch(/Headroom used up: [\d.]+ of [\d.]+|Stopped:|Nothing can move/);
        }
        // and requested weight is moved in full whenever headroom is not the limit
        for (const s of [a, b, d]) {
          if (!s.limitedBelowRequest) expect(s.movedWeight).toBeCloseTo(s.requestedWeight, 6);
        }
      }
    }
  });

  it('responds to intensity at the default threshold: 0 differs from the default, and UP keeps growing past 10', () => {
    for (const c of cells.filter(x => x.scr.endsWith('Overall'))) {
      const moved = STEPS.map(i => c.grid.get(key(i, DEFAULT_LEVERS.threshold))!.movedWeight);
      expect(moved[0]).toBe(0);
      expect(new Set(moved.map(m => m.toFixed(6))).size, `${c.scr}`).toBeGreaterThanOrEqual(2);
    }
    const up = STEPS.map(i => cells.find(x => x.scr === 'UP Overall')!.grid.get(key(i, DEFAULT_LEVERS.threshold))!.movedWeight);
    expect(new Set(up.map(m => m.toFixed(6))).size).toBeGreaterThan(3);
  });

  it('leaves no feasible move behind when it reports used-up headroom', () => {
    for (const c of cells) {
      for (const s of c.grid.values()) {
        if (s.limitedBelowRequest && s.notice?.startsWith('Headroom used up')) expect(s.residualMoves, `${c.scr} ${s.levers.intensity}/${s.levers.threshold}`).toBe(0);
      }
    }
  });

  it('useful intensity marks exactly where moved weight stops increasing', () => {
    for (const c of cells) {
      for (const t of [0, 30, 50, 70, 100]) {
        const u = computeUsefulIntensity(c.channels, c.market, t);
        const full = c.grid.get(key(100, t))!;
        expect(u).toBeGreaterThanOrEqual(0);
        expect(u).toBeLessThanOrEqual(100);
        const atMarker = computeScenario(c.channels, c.market, { intensity: u, threshold: t });
        expect(atMarker.movedWeight, `${c.scr} t=${t} u=${u}`).toBeCloseTo(full.movedWeight, 6);
        if (u > 1) {
          const below = computeScenario(c.channels, c.market, { intensity: u - 1, threshold: t });
          expect(below.movedWeight).toBeLessThan(full.movedWeight - 1e-9);
        }
        if (u === 0) expect(full.movedWeight).toBe(0);
      }
    }
  });

  it('never recommends a move that loses reach under the low curve', () => {
    for (const c of cells) {
      for (const s of c.grid.values()) {
        if (s.layer2) expect(s.layer2.netReachPoints.low).toBeGreaterThanOrEqual(-1e-9);
      }
    }
  });
});

describe('engine behaviour on a controlled region', () => {
  it('moves weight from leaders to laggards and white space at full intensity, no protection', () => {
    const s = computeScenario(syntheticRegion(), 'Maharashtra', { intensity: 100, threshold: 0 });
    const act = (n: string) => s.outcomes.get(n)!.action;
    expect(s.eligibleCount).toBe(10);
    expect(['Lead A', 'Lead B', 'Lead C', 'Lead D'].some(n => act(n) === 'DECREASE')).toBe(true);
    expect(['Lag F', 'Lag G', 'Lag H', 'Lag I', 'White J'].some(n => ['INCREASE', 'ADD'].includes(act(n)))).toBe(true);
    expect(s.layer2!.netReachPoints.base).toBeGreaterThan(0);
    expect(s.layer2!.netReachPoints.low).toBeLessThanOrEqual(s.layer2!.netReachPoints.base);
    expect(s.layer2!.netReachPoints.base).toBeLessThanOrEqual(s.layer2!.netReachPoints.high);
  });

  it('protects the strongest channels first and freezes them from cuts', () => {
    const s = computeScenario(syntheticRegion(), 'Maharashtra', { intensity: 100, threshold: 40 });
    expect(s.protectedCount).toBe(Math.ceil(9 * 0.4)); // 9 active channels
    for (const n of ['Lead A', 'Lead B', 'Lead C', 'Lead D']) {
      if (s.protectedSet.has(n)) expect(s.outcomes.get(n)!.action).not.toBe('DECREASE');
    }
    expect(s.protectedSet.has('Lead A')).toBe(true);
  });

  it('does not depend on input order or on any display filter', () => {
    const base = computeScenario(syntheticRegion(), 'Maharashtra', { intensity: 60, threshold: 30 });
    const shuffled = computeScenario([...syntheticRegion()].reverse(), 'Maharashtra', { intensity: 60, threshold: 30 });
    expect([...shuffled.outcomes].map(([k, v]) => [k, v.action]).sort()).toEqual([...base.outcomes].map(([k, v]) => [k, v.action]).sort());
    expect(shuffled.movedWeight).toBeCloseTo(base.movedWeight, 9);
  });

  it('still caps gap closed at 60% and entry at 50% of competitor when the benefit rule is relaxed', () => {
    const rows = [
      ...['L1', 'L2', 'L3', 'L4', 'L5', 'L6'].map(n => ch({ channel: n, santoorReach: 20, maxCompReach: 5 })),
      ch({ channel: 'Lag', santoorReach: 2, maxCompReach: 10 }),
      ch({ channel: 'Lag2', santoorReach: 3, maxCompReach: 12 }),
      ch({ channel: 'White', santoorReach: 0, maxCompReach: 8, channelShare: 3 }),
    ];
    const original = MODEL_PARAMS.GAIN_OVER_LOSS;
    MODEL_PARAMS.GAIN_OVER_LOSS = 0.001; // force weight to keep flowing until the caps bind
    MODEL_PARAMS.REQUIRE_LOW_CASE_NET = false;
    try {
      const s = computeScenario(rows, 'Maharashtra', { intensity: 100, threshold: 0 });
      let reachedCap = false;
      for (const o of s.outcomes.values()) {
        if (!o.projected) continue;
        for (const band of ['low', 'base', 'high'] as const) {
          const p = o.projected[band];
          if (o.action === 'INCREASE') {
            expect(p).toBeLessThanOrEqual(o.reach + MODEL_PARAMS.MAX_GAP_CLOSED * (o.competitorReach - o.reach) + TOL);
            if (band === 'high' && p >= o.reach + 0.6 * (o.competitorReach - o.reach) - 1e-6) reachedCap = true;
          }
          if (o.action === 'ADD') expect(p).toBeLessThanOrEqual(MODEL_PARAMS.ADD_CAP_OF_COMP * o.competitorReach + TOL);
        }
      }
      expect(reachedCap).toBe(true);
      expect(s.layer2!.gapClosedShare.high).toBeLessThanOrEqual(MODEL_PARAMS.MAX_GAP_CLOSED + 1e-9);
    } finally {
      MODEL_PARAMS.GAIN_OVER_LOSS = original;
      MODEL_PARAMS.REQUIRE_LOW_CASE_NET = true;
    }
  });

  it('suppresses Layer 2 when the region has too few active channels', () => {
    const tiny = [
      ch({ channel: 'T1', santoorReach: 5, maxCompReach: 2 }),
      ch({ channel: 'T2', santoorReach: 3, maxCompReach: 6 }),
      ch({ channel: 'T3', santoorReach: 2, maxCompReach: 5 }),
    ];
    const s = computeScenario(tiny, 'UP', { intensity: 50, threshold: 0 });
    expect(MODEL_PARAMS.MIN_ACTIVE_FOR_LAYER2).toBe(8);
    expect(s.layer2).toBeNull();
    expect(s.layer2SuppressedReason).toMatch(/Only 3 active channels/);
    expect(s.eligibleCount).toBe(3); // Layer 1 still works
  });

  it('never holds a channel because of its language when it has real reach', () => {
    const rows = syntheticRegion();
    rows.push(ch({ channel: 'ABN Andhra Jyothi', santoorReach: 2.4, maxCompReach: 8 }));
    rows.push(ch({ channel: 'Zee Telugu', santoorReach: 0, maxCompReach: 6, channelShare: 3 }));
    const s = computeScenario(rows, 'UP', { intensity: 100, threshold: 0 });
    for (const n of ['ABN Andhra Jyothi', 'Zee Telugu']) {
      expect(s.outcomes.get(n)!.flags).toEqual([]);
      expect(s.outcomes.get(n)!.reason).not.toMatch(/data flag/i);
    }
    expect(['INCREASE', 'ADD']).toContain(s.outcomes.get('ABN Andhra Jyothi')!.action);
  });

  it('no channel with Santoor or competitor reach >= 1.0% is ever held by a language rule (real data)', () => {
    let checked = 0;
    for (const c of cells) {
      const s = c.grid.get(key(15, 30))!;
      for (const o of s.outcomes.values()) {
        if (Math.max(o.reach, o.competitorReach) >= 1.0) {
          checked++;
          for (const f of o.flags) expect(['NO_COMPETITOR_REF', 'IMPOSSIBLE_REACH']).toContain(f);
          expect(o.reason).not.toMatch(/language/i);
        }
      }
      for (const ch0 of c.channels) {
        if (Math.max(ch0.santoorReach, ch0.maxCompReach) >= 1.0) expect(auditChannel(ch0, c.market).languageNote).toBeNull();
      }
    }
    expect(checked).toBeGreaterThan(300);
  });

  it('keeps the large Telugu and Tamil channels in Karnataka in scope', () => {
    const k = cells.find(x => x.scr === 'Karnataka Overall')!;
    const s = k.grid.get(key(15, 30))!;
    for (const n of ['Gemini Movies', 'Gemini TV', 'STAR Maa', 'Zee Telugu', 'Sun TV']) expect(s.outcomes.has(n), n).toBe(true);
  });

  it('gives Karnataka Overall a non-trivial plan at the defaults', () => {
    const s = cells.find(x => x.scr === 'Karnataka Overall')!.grid.get(key(DEFAULT_LEVERS.intensity, DEFAULT_LEVERS.threshold))!;
    expect(s.counts.ADD + s.counts.INCREASE + s.counts.DECREASE).toBeGreaterThanOrEqual(3);
    expect(s.movedWeight).toBeGreaterThan(1);
  });

  it('holds a channel with no usable competitor reference and one with impossible reach', () => {
    const rows = syntheticRegion();
    rows.push(ch({ channel: 'No Ref', santoorReach: 8, maxCompReach: 0, indexVsCompetition: 999 }));
    rows.push(ch({ channel: 'Huge', santoorReach: 145, maxCompReach: 10 }));
    const s = computeScenario(rows, 'Karnataka', { intensity: 100, threshold: 0 });
    expect(s.outcomes.get('No Ref')!.action).toBe('MAINTAIN');
    expect(s.outcomes.get('Huge')!.action).toBe('MAINTAIN');
  });

  it('computes the protected set from a stable ranking with ties broken by share then name', () => {
    const rows = [
      ch({ channel: 'B', santoorReach: 5, maxCompReach: 4, channelShare: 2 }),
      ch({ channel: 'A', santoorReach: 5, maxCompReach: 4, channelShare: 2 }),
      ch({ channel: 'C', santoorReach: 5, maxCompReach: 4, channelShare: 3 }),
      ch({ channel: 'D', santoorReach: 4, maxCompReach: 4, channelShare: 9 }),
    ];
    const p = getProtectedSet(eligibleChannels(rows), 50);
    expect([...p].sort()).toEqual(['A', 'C']);
  });
});

describe('factual notices and parity', () => {
  it('names the real reason when nothing can donate: protection vs data holds', () => {
    // all channels protected
    const rows = syntheticRegion();
    const all = computeScenario(rows, 'Maharashtra', { intensity: 50, threshold: 100 });
    expect(all.notice).toMatch(/threshold protects all 9 active channels/);
    // unprotected channels exist but are all held by data flags
    const held = [
      ch({ channel: 'Big A', santoorReach: 20, maxCompReach: 8 }),
      ch({ channel: 'Big B', santoorReach: 18, maxCompReach: 8 }),
      ch({ channel: 'Big C', santoorReach: 15, maxCompReach: 8 }),
      ch({ channel: 'Big D', santoorReach: 14, maxCompReach: 8 }),
      ch({ channel: 'Big E', santoorReach: 12, maxCompReach: 8 }),
      ch({ channel: 'Big F', santoorReach: 11, maxCompReach: 8 }),
      ch({ channel: 'Big G', santoorReach: 10, maxCompReach: 8 }),
      ch({ channel: 'Big H', santoorReach: 9, maxCompReach: 8 }),
      ch({ channel: 'Gemini TV', santoorReach: 3, maxCompReach: 0.2 }),
      ch({ channel: 'Zee Telugu', santoorReach: 2.5, maxCompReach: 0.2 }),
    ];
    const s = computeScenario(held, 'Karnataka', { intensity: 50, threshold: 80 });
    expect(s.notice).toMatch(/none of the 2 unprotected active channels can give weight \(2 held by data flags/);
    expect(s.notice).not.toMatch(/protects/);
  });

  it('holds donor parity in every band even when the low curve is steep', () => {
    const rows = [
      ch({ channel: 'Edge', santoorReach: 5.0, maxCompReach: 4.8 }),
      ...syntheticRegion().filter(r => r.channel.startsWith('Lag') || r.channel === 'White J'),
      ch({ channel: 'Anchor1', santoorReach: 20, maxCompReach: 6 }),
      ch({ channel: 'Anchor2', santoorReach: 18, maxCompReach: 6 }),
      ch({ channel: 'Anchor3', santoorReach: 15, maxCompReach: 6 }),
    ];
    const s = computeScenario(rows, 'Maharashtra', { intensity: 100, threshold: 25 });
    const edge = s.outcomes.get('Edge')!;
    if (edge.projected) for (const band of ['low', 'base', 'high'] as const) expect(edge.projected[band]).toBeGreaterThanOrEqual(4.8 - 1e-6);
  });

  it('keeps searching after a failing pair and reports no residual feasible move', () => {
    const rows = [
      ...syntheticRegion(),
      ch({ channel: 'Lag K', santoorReach: 3.5, maxCompReach: 9 }),
      ch({ channel: 'Near L', santoorReach: 4.4, maxCompReach: 4.9 }),
    ];
    const s = computeScenario(rows, 'Maharashtra', { intensity: 100, threshold: 0 });
    expect(s.residualMoves).toBe(0);
    expect(s.movedWeight).toBeGreaterThan(0);
    expect(s.layer2!.netReachPoints.low).toBeGreaterThanOrEqual(-1e-9);
  });
});

describe('new-channel funding and headroom claims', () => {
  const repro = () => [
    ch({ channel: 'Leader', santoorReach: 20, maxCompReach: 1 }),
    ch({ channel: 'Trailing donor', santoorReach: 20, maxCompReach: 28 }),
    ch({ channel: 'White', santoorReach: 0, maxCompReach: 3.6, channelShare: 2 }),
  ];

  it('funds a new channel from a single donor when the base-ranked mix fails the low-curve check (reviewer repro)', () => {
    // six held channels (no competitor reference) lift the region over the Layer 2 minimum without joining the moves
    const fillers = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6'].map(n => ch({ channel: n, santoorReach: 5, maxCompReach: 0 }));
    const s = computeScenario([...repro(), ...fillers], 'Maharashtra', { intensity: 100, threshold: 0 });
    expect(s.movedWeight).toBeGreaterThan(0.5);
    expect(s.counts.ADD).toBe(1);
    expect(s.outcomes.get('White')!.action).toBe('ADD');
    expect(s.outcomes.get('Trailing donor')!.action).toBe('DECREASE');
    expect(s.layer2!.netReachPoints.low).toBeGreaterThanOrEqual(0);
    expect(s.residualMoves).toBe(0);
    expect(computeUsefulIntensity(repro(), 'Maharashtra', 0)).toBeGreaterThan(0);
  });

  it('never claims used-up headroom while a low-case-positive move exists', () => {
    for (const c of cells) {
      for (const t of STEPS) {
        const none = c.grid.get(key(0, t))!; // nothing moved: residualMoves is the initial feasible-move count
        const u = computeUsefulIntensity(c.channels, c.market, t);
        if (none.residualMoves > 0) expect(u, `${c.scr} t=${t}`).toBeGreaterThan(0);
        for (const i of STEPS) {
          const s = c.grid.get(key(i, t))!;
          if (s.notice?.startsWith('Headroom used up')) expect(s.residualMoves).toBe(0);
        }
      }
    }
  });

  it('words an untouched trailing donor as behind, never as a negative lead', () => {
    for (const c of cells) {
      const s = c.grid.get(key(15, 30))!;
      for (const o of s.outcomes.values()) expect(o.reason).not.toMatch(/Leads [^,;]* by -|by -\d/);
    }
  });

  it('always describes DECREASE size as a share of modelled weight', () => {
    for (const c of cells) {
      for (const s of c.grid.values()) {
        for (const o of s.outcomes.values()) if (o.action === 'DECREASE') expect(o.reason).toMatch(/% of its modelled weight/);
      }
    }
  });
});

describe('data audit', () => {
  it('recognises regional languages and their home markets', () => {
    expect(detectLanguage('ABN Andhra Jyothi')?.language).toBe('Telugu');
    expect(detectLanguage('Sun Marathi')?.language).toBe('Marathi');
    expect(detectLanguage('Sun Neo')).toBeNull();
    expect(detectLanguage('Zee Kannada')?.language).toBe('Kannada');
  });

  it('only notes (never holds) a language mismatch, and only below the 1.0% evidence bar', () => {
    const low = { santoorReach: 0.4, maxCompReach: 0.6 };
    const real = { santoorReach: 3, maxCompReach: 4 };
    expect(auditChannel(ch({ channel: 'ABN Andhra Jyothi', ...low }), 'UP').languageNote).toMatch(/Telugu/);
    expect(auditChannel(ch({ channel: 'ABN Andhra Jyothi', ...low }), 'UP').flags).toEqual([]);
    expect(auditChannel(ch({ channel: 'ABN Andhra Jyothi', ...real }), 'UP').languageNote).toBeNull();
    expect(auditChannel(ch({ channel: 'Zee Marathi', ...low }), 'UP').languageNote).toMatch(/Marathi/);
    expect(auditChannel(ch({ channel: 'Zee Marathi', ...low }), 'Maharashtra').languageNote).toBeNull();
  });

  it('treats Telugu and Tamil as normal Karnataka viewing, Gujarati as Maharashtra spillover', () => {
    const low = { santoorReach: 0.4, maxCompReach: 0.6 };
    expect(auditChannel(ch({ channel: 'Gemini TV', ...low }), 'Karnataka').languageNote).toBeNull();
    expect(auditChannel(ch({ channel: 'Sun TV', ...low }), 'Karnataka').languageNote).toBeNull();
    expect(auditChannel(ch({ channel: 'Sandesh News', ...low }), 'Maharashtra').languageNote).toBeNull();
    expect(auditChannel(ch({ channel: 'Sandesh News', ...low }), 'UP').languageNote).toMatch(/Gujarati/);
  });

  it('flags the 999 index sentinel, notes reach above 40%, and holds only impossible reach', () => {
    expect(auditChannel(ch({ channel: 'X', santoorReach: 3, maxCompReach: 0, indexVsCompetition: 999 }), 'UP').flags).toContain('NO_COMPETITOR_REF');
    const high = auditChannel(ch({ channel: 'X', santoorReach: 41, maxCompReach: 10 }), 'Karnataka');
    expect(high.flags).toEqual([]); // 40%+ is plausible for a top Kannada GEC: note only
    expect(high.reachNote).toMatch(/41\.0%/);
    expect(auditChannel(ch({ channel: 'X', santoorReach: 120, maxCompReach: 10 }), 'Karnataka').flags).toContain('IMPOSSIBLE_REACH');
  });
});
