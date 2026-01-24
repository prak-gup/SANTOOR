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
  godrejReach?: number;      // UP/Maharashtra
  luxReach?: number;         // UP/Maharashtra
  lifebuoyReach?: number;    // Karnataka
  mysore_sandalReach?: number; // Karnataka

  // Karnataka only
  atcIndex?: number;
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

export type SortField = keyof ChannelRecord;
export type SortDirection = 'asc' | 'desc';
