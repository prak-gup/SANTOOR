// ============================================================
// OPTIMIZATION UTILITIES FOR SANTOOR TV OPTIMIZER
// ============================================================

export interface ChannelRecord {
  channel: string;
  genre: string;
  santoorReach: number;
  maxCompReach: number;
  gap: number;
  channelShare: number;
  indexVsBaseline: number;
  indexVsCompetition: number;
  godrejReach?: number;
  luxReach?: number;
  lifebuoyReach?: number;
  mysore_sandalReach?: number;
  atcIndex?: number;
  optimizationType?: string;
}

export interface OptimizationResult {
  channel: string;
  recommendation: 'INCREASE' | 'MAINTAIN' | 'ADD' | 'DECREASE';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string;
}

// ============================================================
// FILTER: Remove meaningless channels (0% everywhere)
// ============================================================
export function filterRelevantChannels(channels: ChannelRecord[]): ChannelRecord[] {
  return channels.filter(ch =>
    ch.santoorReach > 0.5 ||
    ch.maxCompReach > 0.5 ||
    ch.channelShare > 0.1
  );
}

// ============================================================
// STATUS: Calculate proper status based on competitive position
// ============================================================
export function calculateStatus(ch: ChannelRecord): string {
  // Both zero = inactive
  if (ch.santoorReach === 0 && ch.maxCompReach === 0) {
    return 'INACTIVE';
  }

  // Santoor absent, competitor present = opportunity
  // BUT only if competitor reach is meaningful (>= 2%) AND channel share is significant (>= 1%)
  // This filters out low-value channels that aren't real opportunities
  if (ch.santoorReach === 0 && ch.maxCompReach >= 2.0 && ch.channelShare >= 1.0) {
    return 'OPPORTUNITY';
  }

  // If competitor is present but doesn't meet opportunity thresholds, mark as inactive
  if (ch.santoorReach === 0 && ch.maxCompReach > 0) {
    return 'INACTIVE';
  }

  // Santoor present, competitor absent = monopoly
  if (ch.santoorReach > 0 && ch.maxCompReach === 0) {
    return 'MONOPOLY';
  }

  // Based on competitive index
  if (ch.indexVsCompetition >= 150) return 'DOMINANT';
  if (ch.indexVsCompetition >= 100) return 'LEADING';
  if (ch.indexVsCompetition >= 80) return 'CLOSE';
  if (ch.indexVsCompetition >= 50) return 'BEHIND';

  return 'CRITICAL';
}

// ============================================================
// PROTECTED CHANNELS: Top performers based on threshold
// ============================================================
export function getProtectedChannels(channels: ChannelRecord[], threshold: number): string[] {
  const withSantoor = channels.filter(ch => ch.santoorReach > 0);
  const sorted = [...withSantoor].sort((a, b) => b.santoorReach - a.santoorReach);
  const cutoff = Math.ceil(sorted.length * (threshold / 100));
  return sorted.slice(0, cutoff).map(ch => ch.channel);
}

// ============================================================
// OPTIMIZATION: Generate recommendations
// ============================================================
export function runOptimization(
  channels: ChannelRecord[],
  intensity: number,
  threshold: number
): Map<string, OptimizationResult> {
  const protectedChannels = getProtectedChannels(channels, threshold);
  const results = new Map<string, OptimizationResult>();

  // Intensity affects how aggressively we recommend changes
  const gapThreshold = intensity <= 10 ? -3 : intensity <= 20 ? -2 : -1;
  const indexThreshold = intensity <= 10 ? 70 : intensity <= 20 ? 80 : 90;

  for (const ch of channels) {
    // Skip completely inactive channels
    if (ch.santoorReach === 0 && ch.maxCompReach === 0) continue;

    const isProtected = protectedChannels.includes(ch.channel);

    // OPPORTUNITY → ADD
    // Only recommend ADD if competitor reach is meaningful (>= 2%) AND channel share is significant (>= 1%)
    // This ensures we only suggest adding channels with real potential
    if (ch.santoorReach === 0 && ch.maxCompReach >= 2.0 && ch.channelShare >= 1.0) {
      results.set(ch.channel, {
        channel: ch.channel,
        recommendation: 'ADD',
        priority: ch.maxCompReach > 5 ? 'HIGH' : ch.maxCompReach > 3 ? 'MEDIUM' : 'LOW',
        reason: `Competitor at ${ch.maxCompReach.toFixed(1)}%, Share ${ch.channelShare.toFixed(1)}%`
      });
      continue;
    }

    // BEHIND/CRITICAL → INCREASE (if not protected and gap is significant)
    if (ch.santoorReach > 0 && ch.gap < gapThreshold && ch.indexVsCompetition < indexThreshold) {
      results.set(ch.channel, {
        channel: ch.channel,
        recommendation: 'INCREASE',
        priority: ch.gap < -5 ? 'HIGH' : ch.gap < -2 ? 'MEDIUM' : 'LOW',
        reason: `Gap of ${ch.gap.toFixed(1)} pts, Index ${ch.indexVsCompetition.toFixed(0)}`
      });
      continue;
    }

    // PROTECTED or LEADING → MAINTAIN
    if (isProtected || ch.indexVsCompetition >= 100) {
      results.set(ch.channel, {
        channel: ch.channel,
        recommendation: 'MAINTAIN',
        priority: 'LOW',
        reason: isProtected ? `Top ${threshold}% - protected` : 'Leading competition'
      });
      continue;
    }

    // LOW REACH + NOT PROTECTED → DECREASE (reallocate budget)
    if (!isProtected && ch.santoorReach > 0 && ch.santoorReach < 1.5 && ch.indexVsCompetition > 120) {
      results.set(ch.channel, {
        channel: ch.channel,
        recommendation: 'DECREASE',
        priority: 'LOW',
        reason: `Low reach (${ch.santoorReach.toFixed(1)}%), reallocate budget`
      });
      continue;
    }

    // DEFAULT → MAINTAIN
    if (ch.santoorReach > 0) {
      results.set(ch.channel, {
        channel: ch.channel,
        recommendation: 'MAINTAIN',
        priority: 'LOW',
        reason: 'Stable performance'
      });
    }
  }

  return results;
}

// ============================================================
// STYLES: Colors for status and recommendations
// ============================================================
export const STATUS_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  'DOMINANT':    { bg: 'bg-green-100', text: 'text-green-800', icon: '🏆' },
  'LEADING':     { bg: 'bg-green-50', text: 'text-green-700', icon: '↑' },
  'CLOSE':       { bg: 'bg-yellow-50', text: 'text-yellow-700', icon: '~' },
  'BEHIND':      { bg: 'bg-orange-100', text: 'text-orange-700', icon: '↓' },
  'CRITICAL':    { bg: 'bg-red-100', text: 'text-red-800', icon: '⚠' },
  'OPPORTUNITY': { bg: 'bg-purple-100', text: 'text-purple-800', icon: '+' },
  'MONOPOLY':    { bg: 'bg-blue-100', text: 'text-blue-800', icon: '★' },
  'INACTIVE':    { bg: 'bg-gray-100', text: 'text-gray-400', icon: '-' }
};

export const RECOMMENDATION_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  'INCREASE': { bg: 'bg-green-100', text: 'text-green-800', icon: '↑' },
  'MAINTAIN': { bg: 'bg-blue-100', text: 'text-blue-800', icon: '—' },
  'ADD':      { bg: 'bg-purple-100', text: 'text-purple-800', icon: '+' },
  'DECREASE': { bg: 'bg-red-100', text: 'text-red-800', icon: '↓' }
};

// ============================================================
// SUMMARY HELPERS
// ============================================================
export function getOptimizationSummary(results: Map<string, OptimizationResult>) {
  const arr = [...results.values()];
  return {
    increase: arr.filter(r => r.recommendation === 'INCREASE').length,
    maintain: arr.filter(r => r.recommendation === 'MAINTAIN').length,
    add: arr.filter(r => r.recommendation === 'ADD').length,
    decrease: arr.filter(r => r.recommendation === 'DECREASE').length,
    highPriority: arr.filter(r => r.priority === 'HIGH').length
  };
}
