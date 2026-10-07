// ============================================================
// DATA AUDIT — flags channel rows that look implausible for the market.
// Flags never change the data. They only decide whether the scenario
// engine is allowed to act on a channel (flagged channels are held).
// ============================================================

import type { ChannelRecord } from './optimization';

export type MarketKey = 'UP' | 'Maharashtra' | 'Karnataka';

export type AuditFlag =
  | 'REGIONAL_LANGUAGE' // channel language does not belong to this market
  | 'NO_COMPETITOR_REF' // Santoor reach but competitor reach < MIN_COMP_REF, so index/lead is not meaningful
  | 'HIGH_REACH'; // Santoor reach above 40% on one channel — verify before acting

/** Competitor reach below this (reach %) is treated as "no usable competitor reference". */
export const MIN_COMP_REF = 0.5;
/** Single-channel Santoor reach above this (reach %) is flagged for verification. */
export const HIGH_REACH_FLAG = 40;

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
    homeMarkets: [],
  },
  {
    language: 'Tamil',
    pattern: /tamil|sun (tv|music|life|news)|kalaignar|jaya|raj (tv|musix|digital|news)|vijay|polimer|thanthi|puthiya|captain|murasu|sirippoli|adithya/i,
    homeMarkets: [],
  },
  {
    language: 'Malayalam',
    pattern: /malayalam|asianet(?! suvarna)|surya|kairali|mazhavil|amrita|keralam|flowers tv|manorama|mathrubhumi|reporter tv|media one|jaihind|kappa|kaumudy/i,
    homeMarkets: [],
  },
  {
    language: 'Gujarati',
    pattern: /gujarati|sandesh|vtv|zee 24 kalak|abp asmita|gstv|dd girnar/i,
    homeMarkets: [],
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
  flags: AuditFlag[];
  notes: string[];
}

export function auditChannel(ch: ChannelRecord, market: MarketKey): ChannelAudit {
  const flags: AuditFlag[] = [];
  const notes: string[] = [];
  const hasReach = ch.santoorReach > 0 || ch.maxCompReach > 0;

  const lang = hasReach ? detectLanguage(ch.channel) : null;
  if (lang && !lang.homeMarkets.includes(market)) {
    flags.push('REGIONAL_LANGUAGE');
    notes.push(`${lang.language}-language channel with reach in ${market}`);
  }
  if (ch.santoorReach > 0 && ch.maxCompReach < MIN_COMP_REF) {
    flags.push('NO_COMPETITOR_REF');
    notes.push(
      `competitor reach ${ch.maxCompReach.toFixed(2)}% (index ${Math.round(ch.indexVsCompetition)} is not meaningful)`
    );
  }
  if (ch.santoorReach > HIGH_REACH_FLAG) {
    flags.push('HIGH_REACH');
    notes.push(`Santoor reach ${ch.santoorReach.toFixed(1)}% on a single channel`);
  }
  return { channel: ch.channel, flags, notes };
}

export function auditChannels(channels: ChannelRecord[], market: MarketKey): Map<string, ChannelAudit> {
  const out = new Map<string, ChannelAudit>();
  for (const ch of channels) out.set(ch.channel, auditChannel(ch, market));
  return out;
}
