// Typed access to the multi-market dataset for the scenario engine, its tests and the report script.
import data from '../data/santoor_multimarket_data.json';
import { filterChannelsForMarket } from './channelLanguageFilter';
import type { ChannelRecord } from './optimization';
import type { MarketKey } from './dataAudit';

interface RawMarket {
  scrs: string[];
  competitors: string[];
  channelData: Record<string, ChannelRecord[]>;
}

const MARKETS = (data as unknown as { markets: Record<MarketKey, RawMarket> }).markets;

export const MARKET_KEYS: MarketKey[] = ['UP', 'Maharashtra', 'Karnataka'];

export function scrsFor(market: MarketKey): string[] {
  return MARKETS[market].scrs;
}

/** All channels of a market / SCR after the market's language filter, exactly as the app sees them. */
export function channelsFor(market: MarketKey, scr: string): ChannelRecord[] {
  return filterChannelsForMarket(MARKETS[market].channelData[scr] ?? [], market) as unknown as ChannelRecord[];
}
