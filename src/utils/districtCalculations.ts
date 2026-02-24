import type { ChannelRecord } from '../types';

// --- Types ---

export interface DistrictRecord {
  ser: string;
  scrKey: string;
  district: string;
  syncPop: number;
  censusPop: number;
  urbanPct: number;
  literacyPct: number;
  tvOwnershipPct: number;
  mobilePct: number;
  electrificationPct: number;
  internetPct: number;
  cdmiScore: number;
  allocPctInSer: number;
  reachOverall: number;
  reachUrban: number;
  reachRural: number;
  targetPop: number;
  reachedPop: number;
  confidence: 'High' | 'Medium' | 'Low';
}

export interface DistrictSummary {
  cdmiScore: number;
  reachOverall: number;
  santoorChannels: number;
  opportunities: number;
  avgGap: number;
  confidence: 'High' | 'Medium' | 'Low';
}

// --- Constants ---

/** Maps Excel SER names to the SCR keys used in santoor_multimarket_data.json */
export const SER_TO_SCR_KEY: Record<string, string> = {
  'Awadh': 'Awadh',
  'Braj': 'Braj',
  'Bhojpur': 'Bhojpur',
  'Bundelkhand': 'Bundelkhand',
  'Rohilkhand': 'Rohelkhand',
};

/** Reverse: SCR key → SER display name */
export const SCR_KEY_TO_SER: Record<string, string> = {
  'Awadh': 'Awadh',
  'Braj': 'Braj',
  'Bhojpur': 'Bhojpur',
  'Bundelkhand': 'Bundelkhand',
  'Rohelkhand': 'Rohilkhand',
};

/** Genre categories for affinity calculation */
const GENRE_CATEGORY: Record<string, string> = {
  'News': 'News',
  'Hindi News': 'News',
  'English News': 'English',
  'Business News': 'English',
  'English Entertainment': 'English',
  'English Movies': 'English',
  'Devotional': 'Devotional',
  'Bhojpuri': 'Regional',
  'Punjabi': 'Regional',
  'Regional': 'Regional',
  'Kids': 'Kids',
  'Hindi Movies': 'Movies',
  'Movies': 'Movies',
  'Hindi GEC': 'GEC',
  'GEC': 'GEC',
  'Entertainment': 'GEC',
  'Comedy': 'GEC',
  'Music': 'Music',
  'Sports': 'Sports',
  'Infotainment': 'Infotainment',
  'Lifestyle': 'Infotainment',
  'Reality': 'GEC',
};

// --- Utility Functions ---

/** Deterministic string hash for reproducible jitter */
export function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/** Get districts belonging to a specific SER */
export function getDistrictsForSer(allDistricts: DistrictRecord[], scrKey: string): DistrictRecord[] {
  return allDistricts.filter(d => d.scrKey === scrKey);
}

/** Layer 1: Base CDMI Factor */
export function getBaseCdmiFactor(district: DistrictRecord, serDistricts: DistrictRecord[]): number {
  const serAvgCdmi = serDistricts.reduce((sum, d) => sum + d.cdmiScore, 0) / serDistricts.length;
  const baseFactor = 1 + (district.cdmiScore - serAvgCdmi) * 0.6;
  return Math.max(0.5, Math.min(1.5, baseFactor));
}

/**
 * Layer 2: Genre Affinity Multiplier
 *
 * Models how urban/rural composition affects genre viewership.
 *
 * Key real-world dynamics in Indian TV:
 *
 * - GEC/Entertainment is the BACKBONE of Indian TV. It's #1 everywhere —
 *   urban AND rural. Absolute reach stays high in cities. It does NOT get
 *   an urban penalty. In rural areas it gets a slight boost because GEC
 *   captures an even larger share of limited channel options.
 *
 * - Movies are popular fill-in viewing. Urban areas have slightly more
 *   movie channel access (DTH packages), giving a modest urban boost.
 *   But movies never overtake GEC.
 *
 * - News, English, Sports, Kids, Infotainment: These are ADDITIVE urban
 *   genres. Urban districts have more of these on top of GEC — they grow
 *   in urban without taking from GEC's absolute reach.
 *
 * - Devotional, Regional (Bhojpuri): Rural-skewed genres that lose share
 *   in urban areas where more options are available.
 *
 * The model uses ASYMMETRIC coefficients:
 * - GEC: rural boost only (1.0 → 1.12), never below 1.0
 * - Movies: mild urban boost (1.0 → 1.15), mild rural dip (1.0 → 0.92)
 * - Other genres: standard urban/rural coefficients
 *
 * This means ranking changes happen in the MID-TIER (positions 3-15)
 * where Movies and GEC channels have similar reach and swap positions,
 * while GEC stays strong at the top everywhere.
 */
export function getGenreAffinity(genre: string, urbanPct: number, literacyPct: number): number {
  const category = GENRE_CATEGORY[genre] || 'GEC';
  let affinity: number;

  switch (category) {
    case 'News':
      // News is strongly urban (literacy, current affairs interest)
      affinity = 1 + (urbanPct - 0.15) * 0.65;
      break;
    case 'English':
      // English content: strongest urban skew (language + DTH access)
      affinity = 1 + (urbanPct - 0.15) * 0.75;
      break;
    case 'Devotional':
      // Devotional is rural-skewed: loses share in urban
      affinity = 1 + (0.15 - urbanPct) * 0.50;
      break;
    case 'Regional':
      // Regional/Bhojpuri: strong in rural UP
      affinity = 1 + (0.15 - urbanPct) * 0.40;
      break;
    case 'Kids':
      // Kids channels: DTH + education-oriented households
      affinity = 1 + (urbanPct - 0.15) * 0.35 + (literacyPct - 0.60) * 0.15;
      break;
    case 'Movies':
      // Movies: modest urban boost from DTH variety, mild rural dip.
      // Never enough to overtake GEC — movies are fill-in viewing.
      affinity = 1 + (urbanPct - 0.15) * 0.30;
      break;
    case 'Music':
      // Music: urban-skewed (more channel variety in urban)
      affinity = 1 + (urbanPct - 0.15) * 0.30;
      break;
    case 'Sports':
      // Sports: urban-skewed (non-IPL cricket, niche sports)
      affinity = 1 + (urbanPct - 0.15) * 0.40;
      break;
    case 'Infotainment':
      // Discovery, Animal Planet: needs DTH, urban households
      affinity = 1 + (urbanPct - 0.15) * 0.45;
      break;
    case 'GEC':
    default:
      // GEC/Entertainment: Strong everywhere. In rural, it gets a BOOST
      // because fewer channel options means GEC captures more eyeballs.
      // In urban, it stays at baseline (1.0) — it doesn't decline,
      // other genres just grow alongside it.
      if (urbanPct < 0.20) {
        // Rural boost: max +12% for most rural districts
        affinity = 1 + (0.20 - urbanPct) * 0.70;
      } else {
        // Urban: stable at 1.0, no penalty
        affinity = 1.0;
      }
      break;
  }

  // Clamp range: allows meaningful differentiation without extreme swings
  return Math.max(0.75, Math.min(1.35, affinity));
}

/** Layer 3 + 4: Channel-size variance + deterministic seeded jitter */
export function getChannelJitter(
  districtName: string,
  channelName: string,
  channelShare: number,
  maxShareInSer: number,
  suffix: string = ''
): number {
  const sizeStability = maxShareInSer > 0 ? channelShare / maxShareInSer : 0;
  const varianceRange = (1 - sizeStability) * 0.08;

  const seed = simpleHash(`${districtName}_${channelName}${suffix}`) % 10000;
  const jitter = ((seed / 10000) - 0.5) * 2 * varianceRange;
  return jitter;
}

/** Layer 5: Timeband urban shift adjustments */
export function getTimebandUrbanShift(timeband: string, urbanPct: number): number {
  const urbanShift = (urbanPct - 0.15) * 0.15;

  switch (timeband) {
    case 'NPT':
      return 1 - urbanShift * 0.4;    // Rural boost
    case 'NCPT_EARLY':
      return 1 + urbanShift * 0.1;    // Slight urban boost
    case 'CPT':
      return 1.0;                       // Prime time stable
    case 'NCPT_LATE':
      return 1 + urbanShift * 0.5;    // Strong urban boost
    default:
      return 1.0;
  }
}

/**
 * Layer 6: Channel Presence/Absence Model
 *
 * Not every channel reaches every district. In rural UP, cable networks
 * carry fewer channels and DTH penetration is lower. This model determines
 * whether a channel has any presence in a district at all.
 *
 * Factors:
 * - channelStrength: How strong is this channel at SER level (reach/maxReach)
 *   Big channels (B4U Movies, Dangal) survive everywhere.
 * - districtAccess: How connected is this district (urban + TV ownership)
 *   Lucknow can access all channels; Shravasti loses weaker ones.
 * - Deterministic hash ensures consistent results per channel×district.
 *
 * Effect: Rural districts lose 30-50% of their channel list (the weaker
 * tail channels), while urban districts retain most channels.
 */
export function getChannelPresence(
  districtName: string,
  channelName: string,
  santoorReach: number,
  maxReachInSer: number,
  channelShare: number,
  maxShareInSer: number,
  district: DistrictRecord
): boolean {
  // Channels with zero reach at SER level stay zero
  if (santoorReach <= 0) return false;

  // Channel strength: combines reach and share (both matter for distribution)
  const reachStrength = maxReachInSer > 0 ? santoorReach / maxReachInSer : 0;
  const shareStrength = maxShareInSer > 0 ? channelShare / maxShareInSer : 0;
  const channelStrength = reachStrength * 0.7 + shareStrength * 0.3;

  // District access: how good is the media infrastructure
  const districtAccess = district.urbanPct * 0.35
    + district.tvOwnershipPct * 0.30
    + district.electrificationPct * 0.20
    + district.internetPct * 0.15;

  // Presence score: strong channels survive everywhere, weak ones need good infrastructure
  const presenceScore = channelStrength * 0.55 + districtAccess * 0.45;

  // Per-channel hash adds ±0.04 variation so cutoff isn't uniform
  const seed = simpleHash(`presence_${districtName}_${channelName}`) % 10000;
  const hashVariation = ((seed / 10000) - 0.5) * 0.08;

  // Threshold: channels below this score drop out
  // Calibrated so that in Lucknow (high access ~0.55) almost nothing drops,
  // but in Shravasti (low access ~0.12) channels with reach < ~3-4% drop out
  const threshold = 0.18 + hashVariation;

  return presenceScore >= threshold;
}

/**
 * Main calculation: Scale SER-level channel data to district level
 * using the multi-factor realistic scaling approach.
 */
export function calculateDistrictChannels(
  serChannels: ChannelRecord[],
  district: DistrictRecord,
  serDistricts: DistrictRecord[]
): ChannelRecord[] {
  const baseFactor = getBaseCdmiFactor(district, serDistricts);
  const maxShareInSer = Math.max(...serChannels.map(c => c.channelShare), 0.01);
  const maxReachInSer = Math.max(...serChannels.map(c => c.santoorReach), 0.01);

  return serChannels.map(ch => {
    // Layer 6: Channel presence check — does this channel exist in this district?
    const isPresent = getChannelPresence(
      district.district, ch.channel,
      ch.santoorReach, maxReachInSer,
      ch.channelShare, maxShareInSer,
      district
    );

    if (!isPresent) {
      // Channel has no presence in this district
      return {
        ...ch,
        santoorReach: 0,
        godrejReach: 0,
        luxReach: 0,
        maxCompReach: 0,
        gap: 0,
        indexVsCompetition: 0,
        indexVsBaseline: ch.indexVsBaseline,
        timebands: ch.timebands?.map(tb => ({
          ...tb,
          santoorReach: 0, santoorShare: 0, santoorOTS: 0,
          godrejReach: 0, luxReach: 0, maxCompReach: 0, gap: 0,
        })),
      } as ChannelRecord;
    }

    // Layer 2: Genre affinity (strengthened)
    const genreAffinity = getGenreAffinity(ch.genre, district.urbanPct, district.literacyPct);

    // Layer 3+4: Channel jitter (Santoor)
    const jitter = getChannelJitter(district.district, ch.channel, ch.channelShare, maxShareInSer);

    // Combined factor for Santoor
    const finalFactor = Math.max(0.4, Math.min(1.8, baseFactor * genreAffinity * (1 + jitter)));

    // Competitor jitters (different seeds)
    const compJitter1 = getChannelJitter(district.district, ch.channel, ch.channelShare, maxShareInSer, '_comp1');
    const compJitter2 = getChannelJitter(district.district, ch.channel, ch.channelShare, maxShareInSer, '_comp2');
    const compFactor1 = Math.max(0.4, Math.min(1.8, baseFactor * genreAffinity * (1 + compJitter1)));
    const compFactor2 = Math.max(0.4, Math.min(1.8, baseFactor * genreAffinity * (1 + compJitter2)));

    // Scale reaches
    const santoorReach = +(ch.santoorReach * finalFactor).toFixed(2);
    const godrejReach = ch.godrejReach != null ? +(ch.godrejReach * compFactor1).toFixed(2) : undefined;
    const luxReach = ch.luxReach != null ? +(ch.luxReach * compFactor2).toFixed(2) : undefined;
    const maxCompReach = Math.max(godrejReach || 0, luxReach || 0);
    const gap = +(santoorReach - maxCompReach).toFixed(2);

    // Recompute indices
    const indexVsCompetition = maxCompReach > 0 ? +((santoorReach / maxCompReach) * 100).toFixed(1) : (santoorReach > 0 ? 999 : 0);
    const indexVsBaseline = ch.indexVsBaseline; // Keep baseline index from SER

    // Scale timeband data if present
    let timebands = ch.timebands;
    if (timebands) {
      const rawAdjusted = timebands.map(tb => {
        const tbAdjust = getTimebandUrbanShift(tb.timeband, district.urbanPct);
        return { ...tb, _weight: tbAdjust };
      });

      // Normalize so proportions sum to original proportions
      const totalWeight = rawAdjusted.reduce((s, t) => s + t._weight, 0);

      timebands = rawAdjusted.map(tb => {
        const normalizedAdjust = (tb._weight / totalWeight) * rawAdjusted.length;
        const tbSantoor = +(tb.santoorReach * finalFactor * normalizedAdjust).toFixed(2);
        const tbComp = +(tb.maxCompReach * compFactor1 * normalizedAdjust).toFixed(2);
        const tbGodrej = tb.godrejReach != null ? +(tb.godrejReach * compFactor1 * normalizedAdjust).toFixed(2) : undefined;
        const tbLux = tb.luxReach != null ? +(tb.luxReach * compFactor2 * normalizedAdjust).toFixed(2) : undefined;

        return {
          ...tb,
          santoorReach: tbSantoor,
          santoorShare: +(tb.santoorShare * finalFactor).toFixed(2),
          santoorOTS: +(tb.santoorOTS * finalFactor).toFixed(2),
          godrejReach: tbGodrej,
          luxReach: tbLux,
          maxCompReach: Math.max(tbGodrej || 0, tbLux || 0, tbComp),
          gap: +(tbSantoor - Math.max(tbGodrej || 0, tbLux || 0, tbComp)).toFixed(2),
          _weight: undefined,
        };
      });

      // Clean up _weight
      timebands = timebands.map(({ _weight, ...rest }: any) => rest);
    }

    return {
      ...ch,
      santoorReach,
      godrejReach,
      luxReach,
      maxCompReach,
      gap,
      indexVsCompetition,
      indexVsBaseline,
      timebands,
    } as ChannelRecord;
  });
}

/** Compute district summary from scaled channels */
export function calculateDistrictSummary(
  district: DistrictRecord,
  channels: ChannelRecord[]
): DistrictSummary {
  const withSantoor = channels.filter(c => c.santoorReach > 0);
  const opportunities = channels.filter(c => c.santoorReach === 0 && c.maxCompReach >= 2.0 && c.channelShare >= 1.0);
  const avgGap = withSantoor.length > 0
    ? withSantoor.reduce((s, c) => s + c.gap, 0) / withSantoor.length
    : 0;

  return {
    cdmiScore: district.cdmiScore,
    reachOverall: district.reachOverall,
    santoorChannels: withSantoor.length,
    opportunities: opportunities.length,
    avgGap: +avgGap.toFixed(2),
    confidence: district.confidence as 'High' | 'Medium' | 'Low',
  };
}
