// ============================================================
// TIMEBAND OPTIMIZATION UTILITIES
// ============================================================

import type { TimebandMetrics, TimebandOptimizationScore } from '../types';

/**
 * Calculate optimization score for a timeband
 * Returns a composite score (0-100) based on multiple factors
 */
export function calculateTimebandOptimizationScore(
  timeband: TimebandMetrics,
  allTimebands: TimebandMetrics[],
  market: string
): Omit<TimebandOptimizationScore, 'rank'> {
  // 1. REACH SCORE (40% weight)
  const maxReach = Math.max(...allTimebands.map(tb => tb.santoorReach), 0.01);
  const reachScore = (timeband.santoorReach / maxReach) * 40;

  // 2. COMPETITIVE SCORE (25% weight)
  const competitiveIndex = timeband.maxCompReach > 0
    ? (timeband.santoorReach / timeband.maxCompReach) * 100
    : 150; // If no competition, assume dominant
  const competitiveScore = Math.min(competitiveIndex / 150, 1) * 25;

  // 3. EFFICIENCY SCORE (20% weight)
  const efficiency = timeband.santoorOTS > 0
    ? timeband.santoorReach / timeband.santoorOTS
    : 0;
  const maxEfficiency = Math.max(
    ...allTimebands.map(tb => tb.santoorOTS > 0 ? tb.santoorReach / tb.santoorOTS : 0),
    0.01
  );
  const efficiencyScore = (efficiency / maxEfficiency) * 20;

  // 4. ATC SCORE (15% weight, Karnataka only)
  let atcScore: number | undefined;
  if (market === 'Karnataka' && timeband.atcIndex !== undefined) {
    atcScore = (timeband.atcIndex / 100) * 15;
  }

  const rawScore = reachScore + competitiveScore + efficiencyScore + (atcScore || 0);

  // Determine recommendation based on score
  let recommendation: 'PRIORITY' | 'MAINTAIN' | 'REDUCE';
  if (rawScore >= 70) {
    recommendation = 'PRIORITY';
  } else if (rawScore >= 40) {
    recommendation = 'MAINTAIN';
  } else {
    recommendation = 'REDUCE';
  }

  return {
    timeband: timeband.timeband,
    rawScore,
    components: {
      reachScore,
      competitiveScore,
      efficiencyScore,
      atcScore: market === 'Karnataka' ? atcScore : undefined
    },
    recommendation
  };
}

/**
 * Rank timebands by optimization score
 */
export function rankTimebandsByScore(
  timebands: TimebandMetrics[],
  market: string
): TimebandOptimizationScore[] {
  if (timebands.length === 0) return [];

  // Calculate scores for all timebands
  const scoredTimebands = timebands.map(tb =>
    calculateTimebandOptimizationScore(tb, timebands, market)
  );

  // Sort by raw score descending
  const sorted = [...scoredTimebands].sort((a, b) => b.rawScore - a.rawScore);

  // Assign ranks
  return sorted.map((score, index) => ({
    ...score,
    rank: index + 1
  }));
}

/**
 * Generate timeband-level recommendations
 */
export interface TimebandRecommendation {
  channel: string;
  timeband: string;
  currentReach: number;
  recommendation: 'INCREASE' | 'MAINTAIN' | 'ADD' | 'DECREASE';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string;
  score: number;
}

export function generateTimebandRecommendations(
  channelName: string,
  timebands: TimebandMetrics[],
  market: string,
  intensity: number
): TimebandRecommendation[] {
  if (timebands.length === 0) return [];

  const rankedTimebands = rankTimebandsByScore(timebands, market);
  const recommendations: TimebandRecommendation[] = [];

  // Intensity affects thresholds
  const gapThreshold = intensity <= 10 ? -3 : intensity <= 20 ? -2 : -1;
  const scoreThreshold = intensity <= 10 ? 50 : intensity <= 20 ? 60 : 70;

  for (let i = 0; i < timebands.length; i++) {
    const tb = timebands[i];
    const scored = rankedTimebands.find(r => r.timeband === tb.timeband);

    if (!scored) continue;

    let recommendation: 'INCREASE' | 'MAINTAIN' | 'ADD' | 'DECREASE';
    let priority: 'HIGH' | 'MEDIUM' | 'LOW';
    let reason: string;

    // OPPORTUNITY → ADD
    if (tb.santoorReach === 0 && tb.maxCompReach >= 2.0) {
      recommendation = 'ADD';
      priority = tb.maxCompReach > 5 ? 'HIGH' : tb.maxCompReach > 3 ? 'MEDIUM' : 'LOW';
      reason = `Competitor at ${tb.maxCompReach.toFixed(1)}% in ${tb.timeband} slot`;
    }
    // BEHIND/CRITICAL + HIGH SCORE → INCREASE
    else if (tb.gap < gapThreshold && scored.rawScore >= scoreThreshold) {
      recommendation = 'INCREASE';
      priority = tb.gap < -5 ? 'HIGH' : tb.gap < -2 ? 'MEDIUM' : 'LOW';
      reason = `Gap of ${tb.gap.toFixed(1)} pts, Score ${scored.rawScore.toFixed(0)}`;
    }
    // TOP RANKED → MAINTAIN
    else if (scored.rank <= 3 || tb.gap >= 0) {
      recommendation = 'MAINTAIN';
      priority = 'LOW';
      reason = scored.rank <= 3
        ? `Top ${scored.rank} timeband (Score ${scored.rawScore.toFixed(0)})`
        : `Positive gap ${tb.gap.toFixed(1)} pts`;
    }
    // LOW SCORE + LOW REACH → DECREASE
    else if (scored.rawScore < 30 && tb.santoorReach < 1.0 && !tb.isPrimetime) {
      recommendation = 'DECREASE';
      priority = 'LOW';
      reason = `Low score ${scored.rawScore.toFixed(0)}, reallocate budget`;
    }
    // DEFAULT → MAINTAIN
    else {
      recommendation = 'MAINTAIN';
      priority = 'LOW';
      reason = `Moderate performance (Score ${scored.rawScore.toFixed(0)})`;
    }

    recommendations.push({
      channel: channelName,
      timeband: tb.timeband,
      currentReach: tb.santoorReach,
      recommendation,
      priority,
      reason,
      score: scored.rawScore
    });
  }

  return recommendations;
}

/**
 * Run timeband-level optimization across all channels
 */
export function runTimebandOptimization(
  channels: Array<{ channel: string; timebands?: TimebandMetrics[] }>,
  market: string,
  intensity: number
): Map<string, TimebandRecommendation[]> {
  const results = new Map<string, TimebandRecommendation[]>();

  for (const ch of channels) {
    if (!ch.timebands || ch.timebands.length === 0) continue;

    const recommendations = generateTimebandRecommendations(
      ch.channel,
      ch.timebands,
      market,
      intensity
    );

    if (recommendations.length > 0) {
      results.set(ch.channel, recommendations);
    }
  }

  return results;
}

/**
 * Get optimization summary for timeband recommendations
 */
export interface TimebandOptimizationSummary {
  totalTimebands: number;
  increase: number;
  maintain: number;
  add: number;
  decrease: number;
  highPriority: number;
}

export function getTimebandOptimizationSummary(
  recommendations: Map<string, TimebandRecommendation[]>
): TimebandOptimizationSummary {
  let totalTimebands = 0;
  let increase = 0;
  let maintain = 0;
  let add = 0;
  let decrease = 0;
  let highPriority = 0;

  for (const recs of recommendations.values()) {
    totalTimebands += recs.length;
    for (const rec of recs) {
      if (rec.recommendation === 'INCREASE') increase++;
      else if (rec.recommendation === 'MAINTAIN') maintain++;
      else if (rec.recommendation === 'ADD') add++;
      else if (rec.recommendation === 'DECREASE') decrease++;

      if (rec.priority === 'HIGH') highPriority++;
    }
  }

  return {
    totalTimebands,
    increase,
    maintain,
    add,
    decrease,
    highPriority
  };
}

/**
 * Filter timeband recommendations by priority
 */
export function filterTimebandRecommendationsByPriority(
  recommendations: Map<string, TimebandRecommendation[]>,
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
): Map<string, TimebandRecommendation[]> {
  const filtered = new Map<string, TimebandRecommendation[]>();

  for (const [channel, recs] of recommendations.entries()) {
    const filteredRecs = recs.filter(r => r.priority === priority);
    if (filteredRecs.length > 0) {
      filtered.set(channel, filteredRecs);
    }
  }

  return filtered;
}
