// ============================================================
// CROSS-GEOGRAPHY TIMEBAND ANALYSIS UTILITIES
// ============================================================

import type { CrossGeoTimebandComparison, ChannelRecord } from '../types';

/**
 * Get timeband reach for a specific channel and timeband in a market
 */
export function getTimebandReach(
  channels: ChannelRecord[],
  channelName: string,
  timeband: string
): number {
  const channel = channels.find(ch => ch.channel === channelName);
  if (!channel || !channel.timebands) return 0;

  const timebandData = channel.timebands.find(tb => tb.timeband === timeband);
  return timebandData?.santoorReach || 0;
}

/**
 * Compare timeband performance across all three markets
 */
export function compareTimebandAcrossGeographies(
  channelName: string,
  allMarketData: {
    UP: ChannelRecord[];
    Maharashtra: ChannelRecord[];
    Karnataka: ChannelRecord[];
  }
): CrossGeoTimebandComparison[] {
  const timebandNames = [
    '02:00-05:00',
    '05:00-08:00',
    '08:00-11:00',
    '11:00-14:00',
    '14:00-17:00',
    '17:00-20:00',
    '20:00-23:00',
    '23:00-26:00'
  ];

  return timebandNames.map(tbName => {
    const upReach = getTimebandReach(allMarketData.UP, channelName, tbName);
    const mahReach = getTimebandReach(allMarketData.Maharashtra, channelName, tbName);
    const karReach = getTimebandReach(allMarketData.Karnataka, channelName, tbName);

    const values = [upReach, mahReach, karReach];
    const avg = values.reduce((s, v) => s + v, 0) / 3;

    // Calculate standard deviation
    const variance = Math.sqrt(
      values.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / 3
    );

    // Determine best and worst markets
    let bestMarket = 'UP';
    let worstMarket = 'UP';
    let maxValue = upReach;
    let minValue = upReach;

    if (mahReach > maxValue) {
      maxValue = mahReach;
      bestMarket = 'Maharashtra';
    }
    if (karReach > maxValue) {
      bestMarket = 'Karnataka';
    }

    if (mahReach < minValue) {
      minValue = mahReach;
      worstMarket = 'Maharashtra';
    }
    if (karReach < minValue) {
      worstMarket = 'Karnataka';
    }

    return {
      timeband: tbName,
      markets: {
        UP: upReach,
        Maharashtra: mahReach,
        Karnataka: karReach
      },
      bestPerformingMarket: bestMarket,
      worstPerformingMarket: worstMarket,
      variance
    };
  });
}

/**
 * Identify timebands with significant market divergence
 * (high variance indicates different performance across markets)
 */
export function identifyDivergentTimebands(
  comparisons: CrossGeoTimebandComparison[],
  varianceThreshold: number = 2.0
): CrossGeoTimebandComparison[] {
  return comparisons.filter(c => c.variance >= varianceThreshold);
}

/**
 * Calculate market consistency score for a timeband
 * (0 = completely different, 100 = identical across markets)
 */
export function calculateMarketConsistencyScore(
  comparison: CrossGeoTimebandComparison
): number {
  const values = [
    comparison.markets.UP,
    comparison.markets.Maharashtra,
    comparison.markets.Karnataka
  ];

  const avg = values.reduce((s, v) => s + v, 0) / 3;

  if (avg === 0) return 100; // If all zeros, consider consistent

  // Coefficient of variation (CV) - lower is more consistent
  const cv = comparison.variance / avg;

  // Convert to 0-100 scale (inverted)
  // CV of 0 = 100 score, CV of 1 or higher = 0 score
  return Math.max(0, Math.min(100, (1 - cv) * 100));
}

/**
 * Get top performing timebands across all markets
 */
export function getTopTimebandsByMarket(
  allMarketData: {
    UP: ChannelRecord[];
    Maharashtra: ChannelRecord[];
    Karnataka: ChannelRecord[];
  },
  count: number = 5
): {
  UP: Array<{ timeband: string; reach: number; channel: string }>;
  Maharashtra: Array<{ timeband: string; reach: number; channel: string }>;
  Karnataka: Array<{ timeband: string; reach: number; channel: string }>;
} {
  const extractTopTimebands = (channels: ChannelRecord[]) => {
    const allTimebands: Array<{ timeband: string; reach: number; channel: string }> = [];

    for (const channel of channels) {
      if (!channel.timebands) continue;
      for (const tb of channel.timebands) {
        allTimebands.push({
          timeband: tb.timeband,
          reach: tb.santoorReach,
          channel: channel.channel
        });
      }
    }

    return allTimebands
      .sort((a, b) => b.reach - a.reach)
      .slice(0, count);
  };

  return {
    UP: extractTopTimebands(allMarketData.UP),
    Maharashtra: extractTopTimebands(allMarketData.Maharashtra),
    Karnataka: extractTopTimebands(allMarketData.Karnataka)
  };
}

/**
 * Calculate timeband market penetration
 */
export interface TimebandMarketPenetration {
  timeband: string;
  totalChannels: number;
  channelsWithActivity: number;
  penetrationRate: number;  // percentage
  avgReach: number;
}

export function calculateTimebandMarketPenetration(
  channels: ChannelRecord[],
  timeband: string
): TimebandMarketPenetration {
  const channelsWithTimebands = channels.filter(ch => ch.timebands && ch.timebands.length > 0);
  const channelsWithActivity = channelsWithTimebands.filter(ch => {
    const tb = ch.timebands?.find(t => t.timeband === timeband);
    return tb && tb.santoorReach > 0;
  });

  const totalReach = channelsWithTimebands.reduce((sum, ch) => {
    const tb = ch.timebands?.find(t => t.timeband === timeband);
    return sum + (tb?.santoorReach || 0);
  }, 0);

  const avgReach = channelsWithTimebands.length > 0
    ? totalReach / channelsWithTimebands.length
    : 0;

  const penetrationRate = channelsWithTimebands.length > 0
    ? (channelsWithActivity.length / channelsWithTimebands.length) * 100
    : 0;

  return {
    timeband,
    totalChannels: channelsWithTimebands.length,
    channelsWithActivity: channelsWithActivity.length,
    penetrationRate,
    avgReach
  };
}

/**
 * Compare primetime vs non-primetime across markets
 */
export interface PrimeVsNonPrimeComparison {
  market: string;
  primetimeAvg: number;
  nonPrimetimeAvg: number;
  ratio: number;
  difference: number;
}

export function comparePrimeVsNonPrimeAcrossMarkets(
  allMarketData: {
    UP: ChannelRecord[];
    Maharashtra: ChannelRecord[];
    Karnataka: ChannelRecord[];
  }
): PrimeVsNonPrimeComparison[] {
  const calculateAverage = (channels: ChannelRecord[], isPrime: boolean) => {
    const validChannels = channels.filter(ch =>
      isPrime ? (ch.primetimeReach || 0) > 0 : (ch.nonPrimetimeReach || 0) > 0
    );

    if (validChannels.length === 0) return 0;

    const sum = validChannels.reduce((s, ch) =>
      s + (isPrime ? (ch.primetimeReach || 0) : (ch.nonPrimetimeReach || 0)), 0
    );

    return sum / validChannels.length;
  };

  return [
    {
      market: 'UP',
      primetimeAvg: calculateAverage(allMarketData.UP, true),
      nonPrimetimeAvg: calculateAverage(allMarketData.UP, false),
      ratio: 0,
      difference: 0
    },
    {
      market: 'Maharashtra',
      primetimeAvg: calculateAverage(allMarketData.Maharashtra, true),
      nonPrimetimeAvg: calculateAverage(allMarketData.Maharashtra, false),
      ratio: 0,
      difference: 0
    },
    {
      market: 'Karnataka',
      primetimeAvg: calculateAverage(allMarketData.Karnataka, true),
      nonPrimetimeAvg: calculateAverage(allMarketData.Karnataka, false),
      ratio: 0,
      difference: 0
    }
  ].map(item => ({
    ...item,
    ratio: item.nonPrimetimeAvg > 0 ? item.primetimeAvg / item.nonPrimetimeAvg : 0,
    difference: item.primetimeAvg - item.nonPrimetimeAvg
  }));
}

/**
 * Find channels with consistent timeband performance across markets
 */
export function findConsistentChannels(
  allMarketData: {
    UP: ChannelRecord[];
    Maharashtra: ChannelRecord[];
    Karnataka: ChannelRecord[];
  },
  consistencyThreshold: number = 70
): string[] {
  // Get channels that exist in all three markets
  const upChannels = new Set(allMarketData.UP.map(ch => ch.channel));
  const mahChannels = new Set(allMarketData.Maharashtra.map(ch => ch.channel));
  const karChannels = new Set(allMarketData.Karnataka.map(ch => ch.channel));

  const commonChannels = [...upChannels].filter(ch =>
    mahChannels.has(ch) && karChannels.has(ch)
  );

  const consistentChannels: string[] = [];

  for (const channel of commonChannels) {
    const comparisons = compareTimebandAcrossGeographies(channel, allMarketData);
    const scores = comparisons.map(c => calculateMarketConsistencyScore(c));
    const avgScore = scores.reduce((s, v) => s + v, 0) / scores.length;

    if (avgScore >= consistencyThreshold) {
      consistentChannels.push(channel);
    }
  }

  return consistentChannels;
}
