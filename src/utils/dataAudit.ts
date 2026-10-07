// ============================================================
// DATA AUDIT — flags channel rows that look implausible for the market.
// Flags never change the data. HOLD flags (NO_COMPETITOR_REF, IMPOSSIBLE_REACH) decide whether the
// scenario engine may act on a channel. Language is informational only: observed reach is the
// evidence, so a channel is never held because of its language.
// ============================================================

import type { ChannelRecord } from './optimization';

export type MarketKey = 'UP' | 'Maharashtra' | 'Karnataka';

export type AuditFlag =
  | 'NO_COMPETITOR_REF' // Santoor reach but competitor reach < MIN_COMP_REF, so index/lead is not meaningful
  | 'IMPOSSIBLE_REACH'; // a reach above 100% cannot be real

/** Competitor reach below this (reach %) is treated as "no usable competitor reference". */
export const MIN_COMP_REF = 0.5;
/**
 * A channel with Santoor or competitor reach at or above this (reach %) is real viewing in this market,
 * whatever its language. Language notes are only produced below this bar.
 */
export const EVIDENCE_REACH = 1.0;
/** Santoor reach above this on one channel is noted for verification (informational, never holds a channel). */
export const HIGH_REACH_NOTE = 40;

interface LanguageRule {
  language: string;
  pattern: RegExp;
  homeMarkets: MarketKey[];
}

// Name-pattern list, deliberately small and explicit. Sun Neo / Sun Marathi etc. are
// resolved by rule order (Marathi first). Channels with no match are never flagged.
const LANGUAGE_RULES: LanguageRule[] = [
  {
    language: 'Marathi',
    pattern: /marathi|majha|taas|pravah|zee yuva|zee talkies|zee chitramandir|9x jhakaas|lokmat|saam tv|jai maharashtra|fakt/i,
    homeMarkets: ['Maharashtra'],
  },
  {
    language: 'Kannada',
    pattern: /kannada|suvarna|udaya|public (tv|music|movies)|kasthuri/i,
    homeMarkets: ['Karnataka'],
  },
  {
    language: 'Telugu',
    pattern: /telugu|andhra|\bmaa\b|gemini|etv (abhiruchi|plus|life|cinema)|zee cinemalu|sakshi|tv ?5 news|\bntv\b|\babn\b|\bv6\b|10tv|mahaa|hmtv|studio n/i,
    homeMarkets: ['Karnataka'], // large Telugu viewing in Bengaluru and the border districts
  },
  {
    language: 'Tamil',
    pattern: /tamil|sun (tv|music|life|news)|kalaignar|jaya|raj (tv|musix|digital|news)|vijay|polimer|thanthi|puthiya|captain|murasu|sirippoli|adithya/i,
    homeMarkets: ['Karnataka'], // Bengaluru and the Tamil Nadu border
  },
  {
    language: 'Malayalam',
    pattern: /malayalam|asianet(?! suvarna)|surya|kairali|mazhavil|amrita|keralam|flowers tv|manorama|mathrubhumi|reporter tv|media one|jaihind|kappa|kaumudy/i,
    homeMarkets: [],
  },
  {
    language: 'Gujarati',
    pattern: /gujarati|sandesh|vtv|zee 24 kalak|abp asmita|gstv|dd girnar/i,
    homeMarkets: ['Maharashtra'], // spillover from Gujarat and the Mumbai belt
  },
  {
    language: 'Bengali',
    pattern: /bangla|bengali|star jalsha|sananda|aakash aath|abp ananda|24 ghanta/i,
    homeMarkets: [],
  },
  {
    language: 'Punjabi/Odia',
    pattern: /punjabi|\bptc\b|chardikla|odia|sarthak|tarang/i,
    homeMarkets: [],
  },
];

export function detectLanguage(channelName: string): LanguageRule | null {
  for (const rule of LANGUAGE_RULES) {
    if (rule.pattern.test(channelName)) return rule;
  }
  return null;
}

export interface ChannelAudit {
  channel: string;
  /** Hold flags: the engine will not act on a flagged channel. */
  flags: AuditFlag[];
  /** Reasons behind the hold flags. */
  notes: string[];
  /** Informational only (never holds a channel): language that is not typical for this market, below the evidence bar. */
  languageNote: string | null;
  /** Informational only: unusually high single-channel reach worth a glance. */
  reachNote: string | null;
}

export function auditChannel(ch: ChannelRecord, market: MarketKey): ChannelAudit {
  const flags: AuditFlag[] = [];
  const notes: string[] = [];
  const hasReach = ch.santoorReach > 0 || ch.maxCompReach > 0;

  const lang = hasReach && Math.max(ch.santoorReach, ch.maxCompReach) < EVIDENCE_REACH ? detectLanguage(ch.channel) : null;
  const languageNote =
    lang && !lang.homeMarkets.includes(market)
      ? `${lang.language}-language channel, not typical for ${market}; reach is below ${EVIDENCE_REACH.toFixed(1)}% so it carries little evidence`
      : null;
  if (ch.santoorReach > 0 && ch.maxCompReach < MIN_COMP_REF) {
    flags.push('NO_COMPETITOR_REF');
    notes.push(
      `competitor reach ${ch.maxCompReach.toFixed(2)}% (index ${Math.round(ch.indexVsCompetition)} is not meaningful)`
    );
  }
  if (ch.santoorReach > 100 || ch.maxCompReach > 100) {
    flags.push('IMPOSSIBLE_REACH');
    notes.push(`reach above 100% (Santoor ${ch.santoorReach.toFixed(1)}%, competitor ${ch.maxCompReach.toFixed(1)}%)`);
  }
  const reachNote =
    ch.santoorReach > HIGH_REACH_NOTE
      ? `Santoor reach ${ch.santoorReach.toFixed(1)}% on one channel; plausible for a top regional general-entertainment channel, verify only if unexpected`
      : null;
  return { channel: ch.channel, flags, notes, languageNote, reachNote };
}

export function auditChannels(channels: ChannelRecord[], market: MarketKey): Map<string, ChannelAudit> {
  const out = new Map<string, ChannelAudit>();
  for (const ch of channels) out.set(ch.channel, auditChannel(ch, market));
  return out;
}
