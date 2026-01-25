// ============================================================
// TIMEBAND ANALYSIS UTILITIES
// ============================================================

import type { TimebandMetrics, TimebandPerformanceIndex, ChannelRecord } from '../types';

/**
 * Calculate status for a timeband based on competitive position
 */
export function getTimebandStatus(tb: TimebandMetrics): string {
  // Opportunity: Santoor absent, strong competitor presence
  if (tb.santoorReach === 0 && tb.maxCompReach >= 2.0) {
    return 'OPPORTUNITY';
  }

  // Inactive: No activity
  if (tb.santoorReach === 0) {
    return 'INACTIVE';
  }

  // Dominant: Significant lead
  if (tb.gap >= 5) {
    return 'DOMINANT';
  }

  // Leading: Positive gap
  if (tb.gap >= 0) {
    return 'LEADING';
  }

  // Close: Slight deficit
  if (tb.gap >= -3) {
    return 'CLOSE';
  }

  // Behind: Moderate deficit
  if (tb.gap >= -8) {
    return 'BEHIND';
  }

  // Critical: Large deficit
  return 'CRITICAL';
}

/**
 * Generate recommendation for a timeband
 */
export function getTimebandRecommendation(tb: TimebandMetrics): string {
  const status = getTimebandStatus(tb);

  if (status === 'OPPORTUNITY') return 'ADD';
  if (status === 'CRITICAL' || status === 'BEHIND') return 'INCREASE';
  if (status === 'DOMINANT' || status === 'LEADING') return 'MAINTAIN';
  if (tb.santoorReach < 0.5 && !tb.isPrimetime) return 'DECREASE';

  return 'MAINTAIN';
}

/**
 * Calculate timeband gap analysis
 */
export interface TimebandGapAnalysis {
  timeband: string;
  santoorReach: number;
  maxCompetitorReach: number;
  absoluteGap: number;
  gapPercentage: number;
  status: string;
  recommendation: string;
}

export function calculateTimebandGapAnalysis(
  _channel: string,
  timebands: TimebandMetrics[]
): TimebandGapAnalysis[] {
  return timebands.map(tb => ({
    timeband: tb.timeband,
    santoorReach: tb.santoorReach,
    maxCompetitorReach: tb.maxCompReach,
    absoluteGap: tb.gap,
    gapPercentage: tb.maxCompReach > 0
      ? ((tb.gap / tb.maxCompReach) * 100)
      : 0,
    status: getTimebandStatus(tb),
    recommendation: getTimebandRecommendation(tb)
  }));
}

/**
 * Calculate timeband performance index
 */
export function calculateTimebandPerformance(
  timeband: TimebandMetrics,
  channelAggregate: ChannelRecord,
  primetimeAvg: number
): TimebandPerformanceIndex {
  const shareOfChannel = channelAggregate.santoorReach > 0
    ? (timeband.santoorReach / channelAggregate.santoorReach) * 100
    : 0;

  const competitiveIndex = timeband.maxCompReach > 0
    ? (timeband.santoorReach / timeband.maxCompReach) * 100
    : 150; // If no competition, assume dominant

  const efficiencyScore = timeband.santoorOTS > 0
    ? timeband.santoorReach / timeband.santoorOTS
    : 0;

  const primetimePremium = primetimeAvg > 0
    ? ((timeband.santoorReach / primetimeAvg) - 1) * 100
    : 0;

  return {
    timeband: timeband.timeband,
    absoluteReach: timeband.santoorReach,
    shareOfChannel,
    competitiveIndex,
    efficiencyScore,
    primetimePremium
  };
}

/**
 * Get all timeband performance indices for a channel
 */
export function getChannelTimebandPerformances(
  channel: ChannelRecord
): TimebandPerformanceIndex[] {
  if (!channel.timebands || channel.timebands.length === 0) {
    return [];
  }

  const primetimeAvg = channel.primetimeReach || 0;

  return channel.timebands.map(tb =>
    calculateTimebandPerformance(tb, channel, primetimeAvg)
  );
}

/**
 * Find best performing timebands for a channel
 */
export function findTopTimebands(
  channel: ChannelRecord,
  count: number = 3,
  metric: 'reach' | 'gap' | 'efficiency' = 'reach'
): TimebandMetrics[] {
  if (!channel.timebands || channel.timebands.length === 0) {
    return [];
  }

  const sorted = [...channel.timebands].sort((a, b) => {
    if (metric === 'reach') return b.santoorReach - a.santoorReach;
    if (metric === 'gap') return b.gap - a.gap;
    // efficiency
    const aEff = a.santoorOTS > 0 ? a.santoorReach / a.santoorOTS : 0;
    const bEff = b.santoorOTS > 0 ? b.santoorReach / b.santoorOTS : 0;
    return bEff - aEff;
  });

  return sorted.slice(0, count);
}

/**
 * Get timeband summary statistics
 */
export interface TimebandSummary {
  totalTimebands: number;
  activeTimebands: number;  // Santoor reach > 0
  primeTimebands: number;
  averageReach: number;
  averageGap: number;
  bestTimeband: string;
  worstTimeband: string;
  primeVsNonPrime: number;  // Ratio
}

export function getTimebandSummary(channel: ChannelRecord): TimebandSummary | null {
  if (!channel.timebands || channel.timebands.length === 0) {
    return null;
  }

  const timebands = channel.timebands;
  const activeTimebands = timebands.filter(tb => tb.santoorReach > 0);
  const primeTimebands = timebands.filter(tb => tb.isPrimetime);

  const averageReach = timebands.reduce((sum, tb) => sum + tb.santoorReach, 0) / timebands.length;
  const averageGap = timebands.reduce((sum, tb) => sum + tb.gap, 0) / timebands.length;

  const sorted = [...timebands].sort((a, b) => b.santoorReach - a.santoorReach);
  const bestTimeband = sorted[0].timeband;
  const worstTimeband = sorted[sorted.length - 1].timeband;

  const primeVsNonPrime = channel.nonPrimetimeReach && channel.nonPrimetimeReach > 0
    ? (channel.primetimeReach || 0) / channel.nonPrimetimeReach
    : 0;

  return {
    totalTimebands: timebands.length,
    activeTimebands: activeTimebands.length,
    primeTimebands: primeTimebands.length,
    averageReach,
    averageGap,
    bestTimeband,
    worstTimeband,
    primeVsNonPrime
  };
}

/**
 * Filter timebands by status
 */
export function filterTimebandsByStatus(
  timebands: TimebandMetrics[],
  status: string
): TimebandMetrics[] {
  return timebands.filter(tb => getTimebandStatus(tb) === status);
}

/**
 * Get timeband distribution summary
 */
export interface TimebandDistribution {
  dominant: number;
  leading: number;
  close: number;
  behind: number;
  critical: number;
  opportunity: number;
  inactive: number;
}

export function getTimebandDistribution(channel: ChannelRecord): TimebandDistribution {
  if (!channel.timebands || channel.timebands.length === 0) {
    return {
      dominant: 0,
      leading: 0,
      close: 0,
      behind: 0,
      critical: 0,
      opportunity: 0,
      inactive: 0
    };
  }

  const distribution: TimebandDistribution = {
    dominant: 0,
    leading: 0,
    close: 0,
    behind: 0,
    critical: 0,
    opportunity: 0,
    inactive: 0
  };

  for (const tb of channel.timebands) {
    const status = getTimebandStatus(tb);
    const key = status.toLowerCase() as keyof TimebandDistribution;
    if (key in distribution) {
      distribution[key]++;
    }
  }

  return distribution;
}
