// Usage: INTENSITY=15 THRESHOLD=70 [AUDIT=1] npx vite-node scripts/model-report.ts
// Prints Layer 1 + Layer 2 numbers for every market / SCR, plus the data audit.
import { channelsFor, MARKET_KEYS, scrsFor } from '../src/utils/marketData';
import { computeScenario, DEFAULT_LEVERS } from '../src/utils/scenario';
import { auditChannels } from '../src/utils/dataAudit';
import { eligibleChannels } from '../src/utils/scenario';

const intensity = Number(process.env.INTENSITY ?? DEFAULT_LEVERS.intensity);
const threshold = Number(process.env.THRESHOLD ?? DEFAULT_LEVERS.threshold);
const audit = process.env.AUDIT === '1';
const f = (n: number, d = 1) => n.toFixed(d);

for (const m of MARKET_KEYS) {
  for (const scr of scrsFor(m)) {
    const ch = channelsFor(m, scr);
    const s = computeScenario(ch, m, { intensity, threshold });
    const l2 = s.layer2;
    if (process.env.DETAIL === '1' && scr.endsWith('Overall')) {
      console.log(`\n#### ${scr} notice: ${s.notice}`);
      for (const o of s.outcomes.values()) if (o.action !== 'MAINTAIN') console.log(`  [${o.action}/${o.priority}] ${o.channel}: ${o.reason}`);
      const sample = [...s.outcomes.values()].filter(o => o.action === 'MAINTAIN').slice(0, 4);
      for (const o of sample) console.log(`  [MAINTAIN] ${o.channel}: ${o.reason}`);
    }
    console.log(
      `${scr.padEnd(20)} elig ${s.eligibleCount} act ${s.activeCount} prot ${s.protectedCount} (${f(s.protectedWeightShare * 100, 0)}% wt) | ` +
        `ADD ${s.counts.ADD} INC ${s.counts.INCREASE} MNT ${s.counts.MAINTAIN} DEC ${s.counts.DECREASE} hi ${s.highPriority} int ${f(s.interventionRate * 100, 0)}% | ` +
        `moved ${f(s.movedWeight, 2)} pts = ${f(s.movedShareUnprotected * 100, 0)}% unprot / ${f(s.movedShareRoster * 100, 1)}% roster (req ${f(s.requestedWeight, 2)} of ${f(s.unprotectedWeight, 1)}) ${s.limitedBelowRequest ? 'LIMITED' : ''} | ` +
        (l2
          ? `net ${f(l2.netReachPoints.low, 2)}/${f(l2.netReachPoints.base, 2)}/${f(l2.netReachPoints.high, 2)} gapClosed ${f(l2.gapClosedShare.low * 100, 0)}/${f(l2.gapClosedShare.base * 100, 0)}/${f(l2.gapClosedShare.high * 100, 0)}% donorLoss ${f(l2.donorReachLossShare.base * 100, 0)}%`
          : 'L2 suppressed')
    );
  }
}

if (audit) {
  // Compact audit: channels with Santoor reach > 0 that carry a flag, across every SCR of the market.
  for (const m of MARKET_KEYS) {
    const seen = new Map<string, { flags: string; maxReach: number; comp: number; scrs: number; note: string; eligible: boolean }>();
    for (const scr of scrsFor(m)) {
      const ch = channelsFor(m, scr);
      const all = auditChannels(ch, m);
      const elig = new Set(eligibleChannels(ch).map(c => c.channel));
      for (const c of ch) {
        const a = all.get(c.channel);
        if (!a || a.flags.length === 0 || c.santoorReach <= 0) continue;
        const prev = seen.get(c.channel);
        seen.set(c.channel, {
          flags: a.flags.join('+'),
          maxReach: Math.max(prev?.maxReach ?? 0, c.santoorReach),
          comp: c.maxCompReach,
          scrs: (prev?.scrs ?? 0) + 1,
          note: a.notes[0],
          eligible: (prev?.eligible ?? false) || elig.has(c.channel),
        });
      }
    }
    console.log(`\n== ${m}: ${seen.size} flagged channels with Santoor reach > 0 (any SCR)`);
    for (const [name, v] of [...seen].sort((a, b) => b[1].maxReach - a[1].maxReach))
      console.log(`  ${v.eligible ? 'IN-SCOPE ' : 'below-scope'} ${name} [${v.flags}] max reach ${v.maxReach} comp ${v.comp} in ${v.scrs} SCRs :: ${v.note}`);
  }
}
