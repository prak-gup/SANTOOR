// Timeband metrics for a specific timeband window (4-BAND SYSTEM)
export interface TimebandMetrics {
  timeband: string;              // "NPT", "NCPT_EARLY", "CPT", "NCPT_LATE"
  santoorReach: number;          // Reach % for Santoor in this timeband
  santoorShare: number;          // Share % for Santoor
  santoorOTS: number;            // Opportunity to See
  godrejReach?: number;          // Competitor reach (UP/Rest of Maharashtra)
  luxReach?: number;
  lifebuoyReach?: number;        // Karnataka
  mysore_sandalReach?: number;
  maxCompReach: number;          // Max competitor reach in timeband
  gap: number;                   // Santoor - Max Competitor
  atcIndex?: number;             // Karnataka ATC index for timeband
  isPrimetime: boolean;          // Auto-categorized (18:00-23:59)
  daypartCategory: 'non-prime' | 'non-core-prime' | 'core-prime';  // 4-band system
}

// Timeband performance index for comparison
export interface TimebandPerformanceIndex {
  timeband: string;
  absoluteReach: number;           // Raw reach %
  shareOfChannel: number;          // What % of channel's total reach comes from this timeband
  competitiveIndex: number;        // (Santoor / MaxComp) × 100
  efficiencyScore: number;         // Reach per insertion (reach / OTS)
  primetimePremium: number;        // How much better/worse than primetime average
}

// Timeband optimization score for ranking
export interface TimebandOptimizationScore {
  timeband: string;
  rawScore: number;           // 0-100 composite score
  components: {
    reachScore: number;       // 40% weight
    competitiveScore: number; // 25% weight
    efficiencyScore: number;  // 20% weight
    atcScore?: number;        // 15% weight (Karnataka only)
  };
  rank: number;               // 1-4 within channel (4-band system)
  recommendation: 'PRIORITY' | 'MAINTAIN' | 'REDUCE';
}

// Cross-geography timeband comparison
export interface CrossGeoTimebandComparison {
  timeband: string;
  markets: {
    UP: number;
    Maharashtra: number;
    Karnataka: number;
  };
  bestPerformingMarket: string;
  worstPerformingMarket: string;
  variance: number;  // Standard deviation across markets
}

// NEW: Simplified planner insights (3 metrics + 1 action + 1 recommendation)
// Reduces cognitive overload by focusing on essential actionable insights
export interface SimplifiedPlannerInsights {
  // 3 KEY METRICS
  primeTimeFocus: number;        // 0-100% (% of total reach from prime slots)
  opportunityScore: number;      // 0-100 (how much upside exists based on gaps)
  topActionPriority: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

  // 1 TOP ACTION
  topAction: {
    timeband: string;
    action: 'INVEST' | 'MAINTAIN' | 'REDUCE';
    reason: string;              // Simple 1-sentence explanation
    estimatedUplift: number;     // Expected reach gain %
  } | null;

  // 1 SIMPLE RECOMMENDATION
  recommendation: string;          // Plain English advice (2-3 sentences max)
}

// Enhanced planner insights for strategic timeband analysis
// DEPRECATED: Use SimplifiedPlannerInsights for cleaner UX
export interface TimebandPlannerInsights {
  // Overall Performance
  totalReachAcrossTimebands: number;
  primeTimeConcentration: number;  // % of total reach from prime slots
  primeEfficiency: number;         // Reach per hour in prime vs non-prime

  // Competitive Intelligence
  competitivePosition: {
    dominantInBands: string[];     // Timebands where Santoor leads
    vulnerableBands: string[];     // Timebands where trailing significantly
    opportunityBands: string[];    // Timebands with low competition
    contestedBands: string[];      // Timebands with tight competition
  };

  // Budget Optimization
  budgetAllocationRecommendation: {
    currentSplit: Record<string, number>;      // Current % spend by band
    recommendedSplit: Record<string, number>;  // Optimized % spend
    expectedUplift: number;                    // Projected reach increase %
    reasoning: string;                         // Plain English explanation
  };

  // Prime Time Analysis (4-BAND SYSTEM)
  primeTimePerformance: {
    cptReach: number;              // Core prime reach (19:00-21:59)
    ncptReach: number;             // Non-core prime reach (avg of 18:00-18:59 & 22:00-23:59)
    nptReach: number;              // Non-prime reach (00:00-17:59)
    primeVsNonPrimeRatio: number;  // (CPT+NCPT) / NPT
    isPrimeDependent: boolean;     // >70% reach from prime slots
    primeROI: number;              // Reach per insertion in prime
  };

  // Cross-Channel Benchmarking
  channelBenchmark: {
    channelRank: number;           // Rank within market
    aboveMarketAverage: boolean;
    bestPerformingBand: string;
    worstPerformingBand: string;
    consistencyScore: number;      // 0-100, low variance = high consistency
  };

  // Priority Actions (Top 3-5)
  topActions: Array<{
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    timeband: string;
    action: 'ADD' | 'INCREASE' | 'DECREASE' | 'MAINTAIN' | 'EXIT';
    currentReach: number;
    competitorReach: number;
    potentialUplift: number;       // Estimated reach gain
    investmentRequired: 'Low' | 'Medium' | 'High';
    reasoning: string;             // Why this action is recommended
  }>;

  // Market-Specific Dynamics
  marketDynamics: {
    market: string;
    isLeadingMarket: boolean;
    crossMarketOpportunities: string[];  // Timebands strong in other markets
    marketSpecificRisks: string[];       // Unique challenges in this market
  };
}

export interface ChannelRecord {
  channel: string;
  genre: string;
  santoorReach: number;
  maxCompReach: number;
  gap: number;
  channelShare: number;
  indexVsBaseline: number;
  indexVsCompetition: number;

  // Market-specific competitor reaches
  godrejReach?: number;      // UP/Rest of Maharashtra
  luxReach?: number;         // UP/Rest of Maharashtra
  lifebuoyReach?: number;    // Karnataka
  mysore_sandalReach?: number; // Karnataka

  // Karnataka only
  atcIndex?: number;

  // NEW: Timeband breakdown (4-BAND SYSTEM)
  timebands?: TimebandMetrics[]; // Array of 4 timeband records (NPT, NCPT_EARLY, CPT, NCPT_LATE)

  // NEW: Computed aggregates
  primetimeReach?: number;       // Aggregate of NCPT_EARLY + CPT + NCPT_LATE (18:00-23:59)
  nonPrimetimeReach?: number;    // NPT (00:00-17:59)
  peakTimeband?: string;         // Timeband with highest Santoor reach
  opportunityTimeband?: string;  // Timeband with largest competitor gap
}

export interface SCRSummary {
  totalChannels: number;
  santoorChannels: number;
  opportunities: number;
  avgGap: number;
  avgAtcIndex?: number; // Karnataka only
  status: 'CRITICAL' | 'BEHIND' | 'CLOSE' | 'LEADING' | 'DOMINANT';
}

export interface MarketData {
  scrs: string[];
  competitors: string[];
  optimizationType: 'Reach' | 'ATC';
  summaries: { [scr: string]: SCRSummary };
  channelData: { [scr: string]: ChannelRecord[] };
}

export interface SantoorData {
  markets: {
    UP: MarketData;
    Maharashtra: MarketData;
    Karnataka: MarketData;
  };
}

export type MarketName = 'UP' | 'Maharashtra' | 'Karnataka';
export type MainViewTab = 'channel' | 'timeband' | 'district';

export type SortField = keyof ChannelRecord;
export type SortDirection = 'asc' | 'desc';
