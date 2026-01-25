// ============================================================
// PLANNER INSIGHTS - STRATEGIC TIMEBAND ANALYSIS
// ============================================================

import type { ChannelRecord, TimebandMetrics, TimebandPlannerInsights, SimplifiedPlannerInsights } from '../types';
import { TIMEBAND_DISPLAY_V2 } from './timebandProcessor';

// ============================================================
// NEW: SIMPLIFIED INSIGHTS (3 metrics + 1 action + 1 recommendation)
// Replaces complex 16-data-point system with focused actionable insights
// ============================================================

/**
 * Generate simplified planner insights for a channel's timeband performance
 * Focuses on 3 key metrics, 1 top action, and 1 simple recommendation
 */
export function generateSimplifiedInsights(
  channel: ChannelRecord,
  _market: string,
  _allChannelsInMarket: ChannelRecord[]
): SimplifiedPlannerInsights {
  if (!channel.timebands || channel.timebands.length === 0) {
    return getEmptySimplifiedInsights();
  }

  // Calculate Prime Time Focus (% of reach from prime slots)
  const primeTimeFocus = calculatePrimeTimeFocus(channel.timebands);

  // Calculate Opportunity Score (0-100 based on gaps)
  const opportunityScore = calculateOpportunityScore(channel.timebands);

  // Find top action
  const topAction = findTopAction(channel.timebands);

  // Generate simple recommendation
  const recommendation = generateRecommendation(channel.timebands, primeTimeFocus, topAction);

  return {
    primeTimeFocus,
    opportunityScore,
    topActionPriority: topAction?.priority || 'NONE',
    topAction: topAction ? {
      timeband: topAction.timeband,
      action: topAction.action,
      reason: topAction.reason,
      estimatedUplift: topAction.estimatedUplift
    } : null,
    recommendation
  };
}

/**
 * Calculate Prime Time Focus: % of total reach from prime slots (NCPT_EARLY, CPT, NCPT_LATE)
 */
function calculatePrimeTimeFocus(timebands: TimebandMetrics[]): number {
  const totalReach = timebands.reduce((sum, tb) => sum + tb.santoorReach, 0);
  if (totalReach === 0) return 0;

  const primeReach = timebands
    .filter(tb => tb.timeband === 'NCPT_EARLY' || tb.timeband === 'CPT' || tb.timeband === 'NCPT_LATE')
    .reduce((sum, tb) => sum + tb.santoorReach, 0);

  return (primeReach / totalReach) * 100;
}

/**
 * Calculate Opportunity Score: 0-100 based on gaps across all timebands
 * Higher score = more upside potential from closing competitive gaps
 */
function calculateOpportunityScore(timebands: TimebandMetrics[]): number {
  // Find vulnerable bands (where we're behind by more than 2%)
  const vulnerableBands = timebands.filter(tb => tb.gap < -2);

  if (vulnerableBands.length === 0) return 0;

  // Sum absolute gaps in vulnerable bands
  const totalVulnerableGap = vulnerableBands.reduce((sum, tb) => sum + Math.abs(tb.gap), 0);

  // Convert to 0-100 scale (capped at 100)
  // Formula: gap * 10 (so a 10% total gap = 100 score)
  const score = Math.min(100, totalVulnerableGap * 10);

  return Math.round(score);
}

/**
 * Find the top action based on worst gap or opportunity
 */
function findTopAction(timebands: TimebandMetrics[]): {
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  timeband: string;
  action: 'INVEST' | 'MAINTAIN' | 'REDUCE';
  reason: string;
  estimatedUplift: number;
} | null {
  // Find timeband with worst gap
  let worstBand: TimebandMetrics | null = null;
  let worstGap = 0;

  for (const tb of timebands) {
    if (tb.gap < worstGap) {
      worstGap = tb.gap;
      worstBand = tb;
    }
  }

  // If no significant gap found, check if we're dominant everywhere
  if (!worstBand || worstGap > -1) {
    const strongBands = timebands.filter(tb => tb.gap > 5);
    if (strongBands.length > 0) {
      const best = strongBands.sort((a, b) => b.gap - a.gap)[0];
      return {
        priority: 'LOW',
        timeband: best.timeband,
        action: 'MAINTAIN',
        reason: `Strong position (+${best.gap.toFixed(1)}%). Maintain current investment to defend market share.`,
        estimatedUplift: 0
      };
    }
    return null;
  }

  // Determine priority based on timeband and gap size
  let priority: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
  let action: 'INVEST' | 'MAINTAIN' | 'REDUCE' = 'INVEST';

  if (worstBand.timeband === 'CPT' && worstGap < -5) {
    priority = 'HIGH';
  } else if (Math.abs(worstGap) > 5) {
    priority = 'HIGH';
  } else if (Math.abs(worstGap) < 2) {
    priority = 'LOW';
  }

  // Calculate estimated uplift (40% capture rate of gap)
  const estimatedUplift = Math.abs(worstGap) * 0.4;

  // Generate reason
  const bandLabel = TIMEBAND_DISPLAY_V2[worstBand.timeband as keyof typeof TIMEBAND_DISPLAY_V2] || worstBand.timeband;
  const reason = `Behind competitor by ${Math.abs(worstGap).toFixed(1)}% in ${bandLabel}. Increasing investment could gain +${estimatedUplift.toFixed(1)}% reach.`;

  return {
    priority,
    timeband: worstBand.timeband,
    action,
    reason,
    estimatedUplift
  };
}

/**
 * Generate simple 2-3 sentence recommendation
 */
function generateRecommendation(
  timebands: TimebandMetrics[],
  primeTimeFocus: number,
  topAction: ReturnType<typeof findTopAction>
): string {
  const isPrimeDependent = primeTimeFocus > 70;
  const cpt = timebands.find(tb => tb.timeband === 'CPT');
  const npt = timebands.find(tb => tb.timeband === 'NPT');

  let recommendation = '';

  // First sentence: Prime dependency
  if (isPrimeDependent) {
    recommendation = `Channel is heavily prime-dependent (${primeTimeFocus.toFixed(0)}% from prime slots). `;
  } else {
    recommendation = `Channel has balanced timeband distribution (${primeTimeFocus.toFixed(0)}% prime, ${(100 - primeTimeFocus).toFixed(0)}% non-prime). `;
  }

  // Second sentence: Key action
  if (topAction && topAction.action === 'INVEST') {
    const bandLabel = TIMEBAND_DISPLAY_V2[topAction.timeband as keyof typeof TIMEBAND_DISPLAY_V2] || topAction.timeband;
    recommendation += `Focus investment on ${bandLabel} where biggest gap exists. `;
  } else if (topAction && topAction.action === 'MAINTAIN') {
    recommendation += `Strong competitive position across timebands - maintain current strategy. `;
  }

  // Third sentence: Additional insight
  if (npt && npt.santoorReach < 1.0 && isPrimeDependent) {
    recommendation += `NPT underperforming - consider testing non-prime slots for cost-effective reach expansion.`;
  } else if (cpt && cpt.gap > 5) {
    recommendation += `Dominant CPT position provides opportunity to optimize spend efficiency.`;
  } else {
    recommendation += `Monitor competitive movements in vulnerable timebands.`;
  }

  return recommendation;
}

/**
 * Return empty simplified insights when no timeband data available
 */
function getEmptySimplifiedInsights(): SimplifiedPlannerInsights {
  return {
    primeTimeFocus: 0,
    opportunityScore: 0,
    topActionPriority: 'NONE',
    topAction: null,
    recommendation: 'No timeband data available for this channel. Unable to generate strategic insights.'
  };
}

// ============================================================
// LEGACY: COMPLEX INSIGHTS (DEPRECATED)
// Kept for backward compatibility - use generateSimplifiedInsights instead
// ============================================================

/**
 * Generate comprehensive planner insights for a channel's timeband performance
 * Provides strategic recommendations for budget allocation and optimization
 */
export function generatePlannerInsights(
  channel: ChannelRecord,
  market: string,
  allChannelsInMarket: ChannelRecord[]
): TimebandPlannerInsights {
  if (!channel.timebands || channel.timebands.length === 0) {
    return getEmptyInsights(market);
  }

  const competitivePosition = analyzeCompetitivePosition(channel.timebands);
  const budgetAllocationRecommendation = optimizeBudgetAllocation(channel.timebands);
  const primeTimePerformance = analyzePrimeTimePerformance(channel.timebands);
  const channelBenchmark = benchmarkAgainstMarket(channel, allChannelsInMarket);
  const topActions = generatePrioritizedActions(channel.timebands, market);
  const marketDynamics = analyzeMarketDynamics(market, channel);

  const totalReachAcrossTimebands = channel.timebands.reduce(
    (sum, tb) => sum + tb.santoorReach,
    0
  );

  const primeReach = (primeTimePerformance.cptReach + primeTimePerformance.ncptReach);
  const primeTimeConcentration = totalReachAcrossTimebands > 0
    ? (primeReach / totalReachAcrossTimebands) * 100
    : 0;

  // Calculate prime efficiency (reach per hour)
  const primeHours = 1 + 3 + 2; // NCPT_EARLY + CPT + NCPT_LATE = 6 hours
  const nonPrimeHours = 18; // NPT = 18 hours
  const primeEfficiency = nonPrimeHours > 0 && primeHours > 0
    ? (primeReach / primeHours) / (primeTimePerformance.nptReach / nonPrimeHours)
    : 0;

  return {
    totalReachAcrossTimebands,
    primeTimeConcentration,
    primeEfficiency,
    competitivePosition,
    budgetAllocationRecommendation,
    primeTimePerformance,
    channelBenchmark,
    topActions,
    marketDynamics
  };
}

/**
 * Analyze competitive position across all 4 timebands
 */
function analyzeCompetitivePosition(timebands: TimebandMetrics[]) {
  const dominantInBands: string[] = [];
  const vulnerableBands: string[] = [];
  const opportunityBands: string[] = [];
  const contestedBands: string[] = [];

  for (const tb of timebands) {
    if (tb.santoorReach === 0 && tb.maxCompReach >= 2.0) {
      opportunityBands.push(tb.timeband);
    } else if (tb.gap >= 5) {
      dominantInBands.push(tb.timeband);
    } else if (tb.gap <= -3) {
      vulnerableBands.push(tb.timeband);
    } else if (Math.abs(tb.gap) < 2) {
      contestedBands.push(tb.timeband);
    }
  }

  return {
    dominantInBands,
    vulnerableBands,
    opportunityBands,
    contestedBands
  };
}

/**
 * Generate budget optimization recommendations
 */
function optimizeBudgetAllocation(timebands: TimebandMetrics[]) {
  const totalReach = timebands.reduce((sum, tb) => sum + tb.santoorReach, 0);

  // Calculate current split based on reach
  const currentSplit: Record<string, number> = {};
  for (const tb of timebands) {
    currentSplit[tb.timeband] = totalReach > 0 ? (tb.santoorReach / totalReach) * 100 : 0;
  }

  // Recommended split prioritizes CPT and competitive gaps
  const recommendedSplit: Record<string, number> = {};
  let reasoning = '';

  // Find bands with large gaps (vulnerable)
  const cpt = timebands.find(tb => tb.timeband === 'CPT');

  if (cpt && cpt.gap < -5) {
    // Critical gap in CPT - allocate more budget here
    recommendedSplit['CPT'] = 50;
    recommendedSplit['NCPT_EARLY'] = 15;
    recommendedSplit['NCPT_LATE'] = 20;
    recommendedSplit['NPT'] = 15;
    reasoning = 'Critical gap in Core Prime Time (CPT). Recommend increasing CPT budget by 10-15% to close competitive gap. CPT drives peak viewership and conversion.';
  } else if (cpt && cpt.gap > 5) {
    // Dominant in CPT - maintain and optimize non-prime
    recommendedSplit['CPT'] = 40;
    recommendedSplit['NCPT_EARLY'] = 15;
    recommendedSplit['NCPT_LATE'] = 15;
    recommendedSplit['NPT'] = 30;
    reasoning = 'Strong position in CPT maintained. Opportunity to optimize non-prime slots (NPT) for cost-effective reach expansion. Consider 10% shift from CPT to NPT for efficiency gains.';
  } else {
    // Balanced approach
    recommendedSplit['CPT'] = 45;
    recommendedSplit['NCPT_EARLY'] = 12;
    recommendedSplit['NCPT_LATE'] = 18;
    recommendedSplit['NPT'] = 25;
    reasoning = 'Balanced allocation maintaining CPT focus while building presence in shoulder slots (NCPT). This distribution maximizes reach while controlling costs.';
  }

  // Calculate expected uplift
  const expectedUplift = 8; // Placeholder - would be calculated based on historical data

  return {
    currentSplit,
    recommendedSplit,
    expectedUplift,
    reasoning
  };
}

/**
 * Analyze prime time performance across 4 bands
 */
function analyzePrimeTimePerformance(timebands: TimebandMetrics[]) {
  const cpt = timebands.find(tb => tb.timeband === 'CPT');
  const ncptEarly = timebands.find(tb => tb.timeband === 'NCPT_EARLY');
  const ncptLate = timebands.find(tb => tb.timeband === 'NCPT_LATE');
  const npt = timebands.find(tb => tb.timeband === 'NPT');

  const cptReach = cpt?.santoorReach || 0;
  const ncptReach = ((ncptEarly?.santoorReach || 0) + (ncptLate?.santoorReach || 0)) / 2;
  const nptReach = npt?.santoorReach || 0;

  const totalPrimeReach = cptReach + (ncptEarly?.santoorReach || 0) + (ncptLate?.santoorReach || 0);
  const totalReach = totalPrimeReach + nptReach;

  const primeVsNonPrimeRatio = nptReach > 0 ? totalPrimeReach / nptReach : 0;
  const isPrimeDependent = totalReach > 0 && (totalPrimeReach / totalReach) > 0.7;

  // Calculate prime ROI (simplified - reach per OTS)
  const primeOTS = (cpt?.santoorOTS || 0) + (ncptEarly?.santoorOTS || 0) + (ncptLate?.santoorOTS || 0);
  const primeROI = primeOTS > 0 ? totalPrimeReach / primeOTS : 0;

  return {
    cptReach,
    ncptReach,
    nptReach,
    primeVsNonPrimeRatio,
    isPrimeDependent,
    primeROI
  };
}

/**
 * Benchmark channel against market average
 */
function benchmarkAgainstMarket(
  channel: ChannelRecord,
  allChannels: ChannelRecord[]
) {
  const channelsWithTimebands = allChannels.filter(c => c.timebands && c.timebands.length > 0);

  if (channelsWithTimebands.length === 0) {
    return {
      channelRank: 0,
      aboveMarketAverage: false,
      bestPerformingBand: '',
      worstPerformingBand: '',
      consistencyScore: 0
    };
  }

  // Calculate market average reach
  const marketAvgReach = channelsWithTimebands.reduce((sum, c) => sum + c.santoorReach, 0) / channelsWithTimebands.length;

  // Rank channel
  const sortedChannels = [...channelsWithTimebands].sort((a, b) => b.santoorReach - a.santoorReach);
  const channelRank = sortedChannels.findIndex(c => c.channel === channel.channel) + 1;

  const aboveMarketAverage = channel.santoorReach > marketAvgReach;

  // Find best and worst performing bands
  let bestBand = '';
  let worstBand = '';
  let maxReach = -Infinity;
  let minReach = Infinity;

  if (channel.timebands) {
    for (const tb of channel.timebands) {
      if (tb.santoorReach > maxReach) {
        maxReach = tb.santoorReach;
        bestBand = tb.timeband;
      }
      if (tb.santoorReach < minReach) {
        minReach = tb.santoorReach;
        worstBand = tb.timeband;
      }
    }
  }

  // Calculate consistency score (lower variance = higher score)
  let consistencyScore = 50;
  if (channel.timebands && channel.timebands.length > 0) {
    const avgReach = channel.timebands.reduce((sum, tb) => sum + tb.santoorReach, 0) / channel.timebands.length;
    const variance = channel.timebands.reduce((sum, tb) => sum + Math.pow(tb.santoorReach - avgReach, 2), 0) / channel.timebands.length;
    const stdDev = Math.sqrt(variance);
    consistencyScore = avgReach > 0 ? Math.max(0, 100 - (stdDev / avgReach) * 100) : 0;
  }

  return {
    channelRank,
    aboveMarketAverage,
    bestPerformingBand: bestBand,
    worstPerformingBand: worstBand,
    consistencyScore: Math.round(consistencyScore)
  };
}

/**
 * Generate top 3-5 prioritized actions
 */
function generatePrioritizedActions(
  timebands: TimebandMetrics[],
  _market: string
) {
  const actions: Array<{
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    timeband: string;
    action: 'ADD' | 'INCREASE' | 'DECREASE' | 'MAINTAIN' | 'EXIT';
    currentReach: number;
    competitorReach: number;
    potentialUplift: number;
    investmentRequired: 'Low' | 'Medium' | 'High';
    reasoning: string;
  }> = [];

  for (const tb of timebands) {
    let priority: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
    let action: 'ADD' | 'INCREASE' | 'DECREASE' | 'MAINTAIN' | 'EXIT' = 'MAINTAIN';
    let potentialUplift = 0;
    let investmentRequired: 'Low' | 'Medium' | 'High' = 'Medium';
    let reasoning = '';

    // Determine action based on status
    if (tb.santoorReach === 0 && tb.maxCompReach >= 2.0) {
      action = 'ADD';
      priority = tb.timeband === 'CPT' ? 'HIGH' : 'MEDIUM';
      potentialUplift = tb.maxCompReach * 0.5; // Conservative estimate
      investmentRequired = tb.timeband === 'CPT' ? 'High' : 'Medium';
      reasoning = `Untapped ${tb.timeband} slot with competitor reach of ${tb.maxCompReach.toFixed(1)}%. Entry opportunity with potential ${potentialUplift.toFixed(1)}% reach gain.`;
    } else if (tb.gap < -5 && tb.timeband === 'CPT') {
      action = 'INCREASE';
      priority = 'HIGH';
      potentialUplift = Math.abs(tb.gap) * 0.6;
      investmentRequired = 'High';
      reasoning = `Critical gap in CPT (${tb.gap.toFixed(1)}%). Peak viewership window requires immediate investment to close competitive gap.`;
    } else if (tb.gap < -3) {
      action = 'INCREASE';
      priority = tb.timeband === 'NCPT_EARLY' || tb.timeband === 'NCPT_LATE' ? 'MEDIUM' : 'LOW';
      potentialUplift = Math.abs(tb.gap) * 0.4;
      investmentRequired = 'Medium';
      reasoning = `Behind competitor in ${tb.timeband} by ${Math.abs(tb.gap).toFixed(1)}%. Moderate investment recommended to improve position.`;
    } else if (tb.gap > 5) {
      action = 'MAINTAIN';
      priority = 'LOW';
      potentialUplift = 0;
      investmentRequired = 'Low';
      reasoning = `Strong position in ${tb.timeband} (+${tb.gap.toFixed(1)}%). Maintain current spend level to defend market share.`;
    } else if (tb.santoorReach < 0.5 && tb.timeband === 'NPT') {
      action = 'DECREASE';
      priority = 'LOW';
      potentialUplift = 0;
      investmentRequired = 'Low';
      reasoning = `Low reach in ${tb.timeband} (${tb.santoorReach.toFixed(1)}%). Consider reallocating budget to higher-performing timebands.`;
    }

    if (action !== 'MAINTAIN' || priority === 'HIGH') {
      actions.push({
        priority,
        timeband: tb.timeband,
        action,
        currentReach: tb.santoorReach,
        competitorReach: tb.maxCompReach,
        potentialUplift,
        investmentRequired,
        reasoning
      });
    }
  }

  // Sort by priority (HIGH > MEDIUM > LOW) and potential uplift
  const priorityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
  actions.sort((a, b) => {
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    }
    return b.potentialUplift - a.potentialUplift;
  });

  // Return top 5 actions
  return actions.slice(0, 5);
}

/**
 * Analyze market-specific dynamics
 */
function analyzeMarketDynamics(
  market: string,
  channel: ChannelRecord
): { market: string; isLeadingMarket: boolean; crossMarketOpportunities: string[]; marketSpecificRisks: string[] } {
  const isLeadingMarket = channel.gap > 2;
  const crossMarketOpportunities: string[] = [];
  const marketSpecificRisks: string[] = [];

  // Market-specific analysis
  if (market === 'Karnataka') {
    if ((channel.atcIndex || 0) < 80) {
      marketSpecificRisks.push('Low ATC index indicates quality of viewership needs improvement');
    }
    crossMarketOpportunities.push('Strong ATC potential in CPT timeband with quality programming');
  } else if (market === 'UP') {
    crossMarketOpportunities.push('Large market with high NPT viewership potential');
  } else if (market === 'Maharashtra') {
    crossMarketOpportunities.push('Premium market with strong NCPT early evening viewership');
  }

  return {
    market,
    isLeadingMarket,
    crossMarketOpportunities,
    marketSpecificRisks
  };
}

/**
 * Return empty insights structure when no timeband data available
 */
function getEmptyInsights(market: string): TimebandPlannerInsights {
  return {
    totalReachAcrossTimebands: 0,
    primeTimeConcentration: 0,
    primeEfficiency: 0,
    competitivePosition: {
      dominantInBands: [],
      vulnerableBands: [],
      opportunityBands: [],
      contestedBands: []
    },
    budgetAllocationRecommendation: {
      currentSplit: {},
      recommendedSplit: {},
      expectedUplift: 0,
      reasoning: 'No timeband data available for this channel.'
    },
    primeTimePerformance: {
      cptReach: 0,
      ncptReach: 0,
      nptReach: 0,
      primeVsNonPrimeRatio: 0,
      isPrimeDependent: false,
      primeROI: 0
    },
    channelBenchmark: {
      channelRank: 0,
      aboveMarketAverage: false,
      bestPerformingBand: '',
      worstPerformingBand: '',
      consistencyScore: 0
    },
    topActions: [],
    marketDynamics: {
      market,
      isLeadingMarket: false,
      crossMarketOpportunities: [],
      marketSpecificRisks: []
    }
  };
}
