// ============================================================
// TIMEBAND PROCESSING UTILITIES
// ============================================================

import type { TimebandMetrics, ChannelRecord } from '../types';

// ============================================================
// 4-BAND PRIME TIME SYSTEM (REVISED FROM 8-BAND)
// ============================================================

// NEW 4-BAND DAYPART CATEGORIZATION
export const DAYPART_CATEGORIES_V2 = {
  'NPT': {
    label: 'Non-Prime Time',
    timeRange: '00:00-17:59',
    startHour: 0,
    endHour: 18,
    duration: 18,  // 18 hours
    category: 'non-prime' as const,
    isPrime: false,
    weight: 0.6,
    description: 'All non-prime viewing hours (midnight to evening)'
  },
  'NCPT_EARLY': {
    label: 'Non-Core Prime Time',
    timeRange: '18:00-18:59',
    startHour: 18,
    endHour: 19,
    duration: 1,  // 1 hour
    category: 'non-core-prime' as const,
    isPrime: true,
    weight: 1.1,
    description: 'Non-Core Prime Time (18:00-18:59)'
  },
  'CPT': {
    label: 'Core Prime Time',
    timeRange: '19:00-21:59',
    startHour: 19,
    endHour: 22,
    duration: 3,  // 3 hours
    category: 'core-prime' as const,
    isPrime: true,
    weight: 1.5,
    description: 'Core Prime Time (19:00-21:59)'
  },
  'NCPT_LATE': {
    label: 'Non-Core Prime Time',
    timeRange: '22:00-23:59',
    startHour: 22,
    endHour: 24,
    duration: 2,  // 2 hours
    category: 'non-core-prime' as const,
    isPrime: true,
    weight: 1.2,
    description: 'Non-Core Prime Time (22:00-23:59)'
  }
};

// ATC conversion factors (4-BAND SYSTEM)
export const ATC_DAYPART_FACTORS_V2 = {
  'NPT': 0.7,          // Lower conversion during non-prime
  'NCPT_EARLY': 1.2,   // Rising engagement (pre-prime)
  'CPT': 1.5,          // HIGHEST - Peak conversion window
  'NCPT_LATE': 1.1     // Declining engagement (post-prime)
};

// Display labels for UI (4-BAND SYSTEM)
export const TIMEBAND_DISPLAY_V2 = {
  'NPT': 'NPT (00-17)',
  'NCPT_EARLY': 'NCPT (18)',
  'CPT': 'CPT (19-21)',
  'NCPT_LATE': 'NCPT (22-23)'
};

// New 4-band labels array
export const TIMEBAND_LABELS = [
  'NPT',
  'NCPT_EARLY',
  'CPT',
  'NCPT_LATE'
];

// Alias for backward compatibility (code references DAYPART_CATEGORIES in parseTimebandData)
export const DAYPART_CATEGORIES = DAYPART_CATEGORIES_V2;

// Legacy 8-band system (kept for backward compatibility during migration)
export const DAYPART_CATEGORIES_LEGACY = {
  '02:00-05:00': { category: 'early-morning' as const, isPrime: false, weight: 0.3 },
  '05:00-08:00': { category: 'morning' as const, isPrime: false, weight: 0.8 },
  '08:00-11:00': { category: 'morning' as const, isPrime: false, weight: 1.1 },
  '11:00-14:00': { category: 'afternoon' as const, isPrime: false, weight: 0.9 },
  '14:00-17:00': { category: 'afternoon' as const, isPrime: false, weight: 1.0 },
  '17:00-20:00': { category: 'evening' as const, isPrime: true, weight: 1.3 },
  '20:00-23:00': { category: 'prime' as const, isPrime: true, weight: 1.2 },
  '23:00-26:00': { category: 'late-night' as const, isPrime: false, weight: 0.7 }
};

/**
 * Normalizes timeband string format
 * Converts "02:00:00 - 05:00:00" to "02:00-05:00"
 */
export function normalizeTimebandString(timeband: string): string {
  return timeband
    .replace(/:\d{2}:\d{2}/g, ':00')  // Remove seconds
    .replace(/\s*-\s*/g, '-')          // Remove spaces around dash
    .replace(/:00/g, '');              // Remove :00 for cleaner display
}

/**
 * Parse raw timeband data and aggregate across months
 * Handles 'n.a' values and calculates maxCompReach per timeband
 */
export function parseTimebandData(
  rawData: any[],
  market: string
): Map<string, TimebandMetrics[]> {
  const channelTimebandMap = new Map<string, Map<string, any>>();

  // Group by channel and timeband
  for (const row of rawData) {
    if (!row.Channel || !row.TimeBand) continue;

    const channel = row.Channel;
    const timeband = normalizeTimebandString(row.TimeBand);

    if (!channelTimebandMap.has(channel)) {
      channelTimebandMap.set(channel, new Map());
    }

    const timebandData = channelTimebandMap.get(channel)!;
    if (!timebandData.has(timeband)) {
      timebandData.set(timeband, {
        reach: [],
        share: [],
        ots: [],
        competitors: {}
      });
    }

    const data = timebandData.get(timeband)!;

    // Parse value, handle 'n.a'
    const value = row.Value === 'n.a' || row.Value === null ? 0 : Number(row.Value);

    // Aggregate metrics
    if (row.Metric === 'Cume Rch% Curve [1+]') {
      if (row.Target_Group === 'Santoor') {
        data.reach.push(value);
      } else {
        if (!data.competitors[row.Target_Group]) {
          data.competitors[row.Target_Group] = [];
        }
        data.competitors[row.Target_Group].push(value);
      }
    } else if (row.Metric === 'rat%') {
      data.share.push(value);
    } else if (row.Metric === 'Ots') {
      data.ots.push(value);
    }
  }

  // Convert to TimebandMetrics array per channel
  const result = new Map<string, TimebandMetrics[]>();

  for (const [channel, timebandData] of channelTimebandMap.entries()) {
    const timebands: TimebandMetrics[] = [];

    for (const timeband of TIMEBAND_LABELS) {
      const data = timebandData.get(timeband);

      if (!data) {
        // Create empty timeband entry if data missing
        timebands.push(createEmptyTimeband(timeband, market));
        continue;
      }

      // Calculate averages across months
      const santoorReach = data.reach.length > 0
        ? data.reach.reduce((a: number, b: number) => a + b, 0) / data.reach.length
        : 0;

      const santoorShare = data.share.length > 0
        ? data.share.reduce((a: number, b: number) => a + b, 0) / data.share.length
        : 0;

      const santoorOTS = data.ots.length > 0
        ? data.ots.reduce((a: number, b: number) => a + b, 0) / data.ots.length
        : 0;

      // Calculate competitor reaches
      const competitorReaches: { [key: string]: number } = {};
      for (const [comp, values] of Object.entries(data.competitors)) {
        const vals = values as number[];
        competitorReaches[comp] = vals.length > 0
          ? vals.reduce((a, b) => a + b, 0) / vals.length
          : 0;
      }

      const maxCompReach = Math.max(0, ...Object.values(competitorReaches));
      const gap = santoorReach - maxCompReach;

      const daypartInfo = DAYPART_CATEGORIES[timeband as keyof typeof DAYPART_CATEGORIES];

      const timebandMetrics: TimebandMetrics = {
        timeband,
        santoorReach,
        santoorShare,
        santoorOTS,
        maxCompReach,
        gap,
        isPrimetime: daypartInfo.isPrime,
        daypartCategory: daypartInfo.category,
        // Add market-specific competitor fields
        ...(market === 'Karnataka' ? {
          lifebuoyReach: competitorReaches['Lifebuoy'] || 0,
          mysore_sandalReach: competitorReaches['Mysore Sandal'] || 0,
          atcIndex: calculateTimebandATCIndex(santoorReach, timeband)
        } : {
          godrejReach: competitorReaches['Godrej'] || 0,
          luxReach: competitorReaches['Lux'] || 0
        })
      };

      timebands.push(timebandMetrics);
    }

    result.set(channel, timebands);
  }

  return result;
}

/**
 * Create empty timeband entry for missing data (4-BAND SYSTEM)
 */
function createEmptyTimeband(timeband: string, market: string): TimebandMetrics {
  const daypartInfo = DAYPART_CATEGORIES_V2[timeband as keyof typeof DAYPART_CATEGORIES_V2];

  return {
    timeband,
    santoorReach: 0,
    santoorShare: 0,
    santoorOTS: 0,
    maxCompReach: 0,
    gap: 0,
    isPrimetime: daypartInfo.isPrime,
    daypartCategory: daypartInfo.category,
    ...(market === 'Karnataka' ? {
      lifebuoyReach: 0,
      mysore_sandalReach: 0,
      atcIndex: 0
    } : {
      godrejReach: 0,
      luxReach: 0
    })
  };
}

/**
 * Calculate ATC index for a timeband (Karnataka only) - 4-BAND SYSTEM
 */
function calculateTimebandATCIndex(reach: number, timeband: string): number {
  const factor = ATC_DAYPART_FACTORS_V2[timeband as keyof typeof ATC_DAYPART_FACTORS_V2] || 1.0;
  return reach * factor * 100; // Convert to index
}

/**
 * Enrich channel record with timeband data and computed aggregates
 */
export function enrichChannelWithTimebands(
  baseChannel: ChannelRecord,
  timebandData: TimebandMetrics[]
): ChannelRecord {
  if (!timebandData || timebandData.length === 0) {
    return baseChannel;
  }

  const primetimeReach = calculatePrimetimeAggregate(timebandData);
  const nonPrimetimeReach = calculateNonPrimetimeAggregate(timebandData);
  const peakTimeband = findPeakTimeband(timebandData, 'santoorReach');
  const opportunityTimeband = findPeakTimeband(timebandData, 'gap');

  return {
    ...baseChannel,
    timebands: timebandData,
    primetimeReach,
    nonPrimetimeReach,
    peakTimeband,
    opportunityTimeband
  };
}

/**
 * Calculate aggregate reach for primetime timebands - 4-BAND SYSTEM
 * Includes all 3 prime bands: NCPT_EARLY (18:00-18:59), CPT (19:00-21:59), NCPT_LATE (22:00-23:59)
 */
export function calculatePrimetimeAggregate(timebands: TimebandMetrics[]): number {
  const primebands = timebands.filter(tb =>
    tb.timeband === 'NCPT_EARLY' || tb.timeband === 'CPT' || tb.timeband === 'NCPT_LATE'
  );

  if (primebands.length === 0) return 0;

  return primebands.reduce((sum, tb) => sum + tb.santoorReach, 0) / primebands.length;
}

/**
 * Calculate aggregate reach for non-primetime timebands - 4-BAND SYSTEM
 * Only includes NPT (00:00-17:59)
 */
export function calculateNonPrimetimeAggregate(timebands: TimebandMetrics[]): number {
  const nonPrimebands = timebands.filter(tb => tb.timeband === 'NPT');

  if (nonPrimebands.length === 0) return 0;

  return nonPrimebands.reduce((sum, tb) => sum + tb.santoorReach, 0) / nonPrimebands.length;
}

/**
 * Find the timeband with the highest value for a given metric
 */
export function findPeakTimeband(
  timebands: TimebandMetrics[],
  metric: 'santoorReach' | 'gap'
): string {
  if (timebands.length === 0) return '';

  const sorted = [...timebands].sort((a, b) => b[metric] - a[metric]);
  return sorted[0].timeband;
}

/**
 * Get channel-specific distribution based on competitive position
 * Varies distribution by channel.gap to create unique patterns per channel
 * Uses granular ranges and genre-based variation for maximum diversity
 */
function getChannelDistribution(channel: ChannelRecord): {
  reach: Record<string, number>;
  comp: Record<string, number>;
} {
  // Add genre-based variation (use channel name hash for consistency)
  const genreVariation = (channel.channel.length % 10) / 100; // 0.00 to 0.09

  // CRITICAL GAP: Behind by >8% - Emergency prime concentration
  if (channel.gap < -8) {
    return {
      reach: {
        'NPT': 0.18 + genreVariation,
        'NCPT_EARLY': 0.07,
        'CPT': 0.60 - genreVariation,  // MASSIVE CPT focus (60%)
        'NCPT_LATE': 0.15
      },
      comp: {
        'NPT': 0.20,
        'NCPT_EARLY': 0.09,
        'CPT': 0.58,
        'NCPT_LATE': 0.13
      }
    };
  }

  // BEHIND: Gap -5 to -8 - Strong prime focus
  else if (channel.gap < -5) {
    return {
      reach: {
        'NPT': 0.22 + genreVariation,
        'NCPT_EARLY': 0.09,
        'CPT': 0.54 - genreVariation,  // High CPT (54%)
        'NCPT_LATE': 0.15
      },
      comp: {
        'NPT': 0.24,
        'NCPT_EARLY': 0.10,
        'CPT': 0.53,
        'NCPT_LATE': 0.13
      }
    };
  }

  // SLIGHTLY BEHIND: Gap -2 to -5 - Moderate prime focus
  else if (channel.gap < -2) {
    return {
      reach: {
        'NPT': 0.28 + genreVariation,
        'NCPT_EARLY': 0.11,
        'CPT': 0.46 - genreVariation,  // Moderate CPT (46%)
        'NCPT_LATE': 0.15
      },
      comp: {
        'NPT': 0.27,
        'NCPT_EARLY': 0.12,
        'CPT': 0.48,
        'NCPT_LATE': 0.13
      }
    };
  }

  // COMPETITIVE: Gap -2 to +2 - Balanced
  else if (channel.gap < 2) {
    return {
      reach: {
        'NPT': 0.33 + genreVariation,
        'NCPT_EARLY': 0.12,
        'CPT': 0.40 - genreVariation,  // Balanced CPT (40%)
        'NCPT_LATE': 0.15
      },
      comp: {
        'NPT': 0.32,
        'NCPT_EARLY': 0.12,
        'CPT': 0.43,
        'NCPT_LATE': 0.13
      }
    };
  }

  // SLIGHTLY AHEAD: Gap +2 to +5 - Expanding to NPT
  else if (channel.gap < 5) {
    return {
      reach: {
        'NPT': 0.40 + genreVariation,  // Expanding NPT (40%)
        'NCPT_EARLY': 0.14,
        'CPT': 0.32 - genreVariation,  // Lower CPT
        'NCPT_LATE': 0.14
      },
      comp: {
        'NPT': 0.36,
        'NCPT_EARLY': 0.12,
        'CPT': 0.40,
        'NCPT_LATE': 0.12
      }
    };
  }

  // LEADING: Gap +5 to +8 - Strong NPT presence
  else if (channel.gap < 8) {
    return {
      reach: {
        'NPT': 0.48 + genreVariation,  // Strong NPT (48%)
        'NCPT_EARLY': 0.16,
        'CPT': 0.24 - genreVariation,  // Minimal CPT
        'NCPT_LATE': 0.12
      },
      comp: {
        'NPT': 0.40,
        'NCPT_EARLY': 0.13,
        'CPT': 0.36,
        'NCPT_LATE': 0.11
      }
    };
  }

  // DOMINANT: Gap >8 - Heavy NPT optimization
  else {
    return {
      reach: {
        'NPT': 0.55 + genreVariation,  // MASSIVE NPT (55%)
        'NCPT_EARLY': 0.18,
        'CPT': 0.15 - genreVariation,  // Minimal CPT (15%)
        'NCPT_LATE': 0.12
      },
      comp: {
        'NPT': 0.44,
        'NCPT_EARLY': 0.14,
        'CPT': 0.32,
        'NCPT_LATE': 0.10
      }
    };
  }
}

/**
 * Generate sample timeband data for channels without timeband information - 4-BAND SYSTEM
 * This is a fallback for development/testing when actual timeband data is not available
 *
 * Distribution now varies by channel's competitive position (gap) to create unique insights
 * - Channels behind: More CPT-concentrated (52% CPT)
 * - Leading channels: More balanced (35% NPT, 38% CPT)
 * - Neutral channels: Standard distribution
 */
export function generateSampleTimebandData(
  channel: ChannelRecord,
  market: string
): TimebandMetrics[] {
  const timebands: TimebandMetrics[] = [];

  // Get channel-specific distribution based on competitive position
  const distribution = getChannelDistribution(channel);
  const reachDistribution = distribution.reach;
  const compDistribution = distribution.comp;

  for (const timeband of TIMEBAND_LABELS) {
    const daypartInfo = DAYPART_CATEGORIES_V2[timeband as keyof typeof DAYPART_CATEGORIES_V2];

    const reachMultiplier = reachDistribution[timeband as keyof typeof reachDistribution];
    const santoorReach = channel.santoorReach * reachMultiplier;

    const compReachMultiplier = compDistribution[timeband as keyof typeof compDistribution];
    const maxCompReach = channel.maxCompReach * compReachMultiplier;

    const gap = santoorReach - maxCompReach;

    timebands.push({
      timeband,
      santoorReach,
      santoorShare: channel.channelShare * reachMultiplier,
      santoorOTS: santoorReach * 0.5, // Approximate OTS
      maxCompReach,
      gap,
      isPrimetime: daypartInfo.isPrime,
      daypartCategory: daypartInfo.category,
      ...(market === 'Karnataka' ? {
        lifebuoyReach: channel.lifebuoyReach ? channel.lifebuoyReach * compReachMultiplier : 0,
        mysore_sandalReach: channel.mysore_sandalReach ? channel.mysore_sandalReach * compReachMultiplier : 0,
        atcIndex: calculateTimebandATCIndex(santoorReach, timeband)
      } : {
        godrejReach: channel.godrejReach ? channel.godrejReach * compReachMultiplier : 0,
        luxReach: channel.luxReach ? channel.luxReach * compReachMultiplier : 0
      })
    });
  }

  return timebands;
}
