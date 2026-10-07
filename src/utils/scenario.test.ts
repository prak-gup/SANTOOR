import { beforeAll, describe, expect, it } from 'vitest';
import { computeScenario, DEFAULT_LEVERS, eligibleChannels, getProtectedSet, MODEL_PARAMS } from './scenario';
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
            expect(r).toBeGreaterThanOrEqual(comp); // only leaders donate
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
      }
    }
  });
});

describe('default levers (intensity 15, threshold 70) stay modest', () => {
  it('keeps the Layer 2 headline small for every market and SCR', () => {
    for (const c of cells) {
      const s = c.grid.get(key(DEFAULT_LEVERS.intensity, DEFAULT_LEVERS.threshold))!;
      expect(s.layer2).not.toBeNull();
      const l2 = s.layer2!;
      expect(l2.gainReachPoints.high).toBeLessThanOrEqual(0.03 * s.rosterWeight);
      expect(Math.abs(l2.netReachPoints.base)).toBeLessThanOrEqual(0.02 * s.rosterWeight);
      expect(l2.gapClosedShare.high).toBeLessThanOrEqual(MODEL_PARAMS.MAX_GAP_CLOSED);
      expect(s.movedShareRoster).toBeLessThanOrEqual(0.05);
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

  it('holds a regional-language channel that does not belong to the market', () => {
    const rows = syntheticRegion();
    rows.push(ch({ channel: 'ABN Andhra Jyothi', santoorReach: 2.4, maxCompReach: 8 }));
    rows.push(ch({ channel: 'Zee Telugu', santoorReach: 0, maxCompReach: 6, channelShare: 3 }));
    const s = computeScenario(rows, 'UP', { intensity: 100, threshold: 0 });
    for (const n of ['ABN Andhra Jyothi', 'Zee Telugu']) {
      const o = s.outcomes.get(n)!;
      expect(o.action).toBe('MAINTAIN');
      expect(o.reason).toMatch(/data flag/i);
    }
  });

  it('holds a channel with no usable competitor reference and one above 40% reach', () => {
    const rows = syntheticRegion();
    rows.push(ch({ channel: 'No Ref', santoorReach: 8, maxCompReach: 0, indexVsCompetition: 999 }));
    rows.push(ch({ channel: 'Huge', santoorReach: 45, maxCompReach: 10 }));
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

describe('data audit', () => {
  it('recognises regional languages and their home markets', () => {
    expect(detectLanguage('ABN Andhra Jyothi')?.language).toBe('Telugu');
    expect(detectLanguage('Sun Marathi')?.language).toBe('Marathi');
    expect(detectLanguage('Sun Neo')).toBeNull();
    expect(detectLanguage('Zee Kannada')?.language).toBe('Kannada');
  });

  it('flags Telugu in UP, but not Marathi in Maharashtra or Kannada in Karnataka', () => {
    const base = { santoorReach: 3, maxCompReach: 4 };
    expect(auditChannel(ch({ channel: 'ABN Andhra Jyothi', ...base }), 'UP').flags).toContain('REGIONAL_LANGUAGE');
    expect(auditChannel(ch({ channel: 'Zee Marathi', ...base }), 'Maharashtra').flags).not.toContain('REGIONAL_LANGUAGE');
    expect(auditChannel(ch({ channel: 'Udaya TV', ...base }), 'Karnataka').flags).not.toContain('REGIONAL_LANGUAGE');
    expect(auditChannel(ch({ channel: 'Zee Marathi', ...base }), 'UP').flags).toContain('REGIONAL_LANGUAGE');
  });

  it('flags the 999 index sentinel and reach above 40%', () => {
    expect(auditChannel(ch({ channel: 'X', santoorReach: 3, maxCompReach: 0, indexVsCompetition: 999 }), 'UP').flags).toContain('NO_COMPETITOR_REF');
    expect(auditChannel(ch({ channel: 'X', santoorReach: 41, maxCompReach: 10 }), 'Karnataka').flags).toContain('HIGH_REACH');
  });
});
