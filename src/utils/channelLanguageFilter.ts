// ============================================================
// CHANNEL LANGUAGE FILTER UTILITY
// ============================================================
// Purpose: Filter out Hindi channels from Karnataka and Maharashtra markets

import type { ChannelRecord, MarketName } from '../types';

// Channel-to-Language mapping from channel-genre.csv
// Manually extracted Hindi channels that should be filtered from Karnataka
const HINDI_CHANNELS = new Set([
  // Hindi Entertainment
  'BIG TV', 'Shemaroo Josh', 'Dangal 2', 'Goldmines', 'Ishara TV',
  'Manoranjan Prime', 'NKTV Plus', 'ON TV', 'Unique TV', 'Anmol TV',
  'Big Magic', 'Colors', 'Colors HD', 'Dangal', 'E24', 'Manoranjan TV',
  'Manoranjan Grand', 'MTV', 'Colors Rishtey', 'Sony Entertainment Television',
  'Sony Entertainment Television HD', 'Sony Pal', 'SONY SAB', 'SONY SAB HD',
  'STAR Bharat', 'STAR Bharat HD', 'STAR Plus HD', 'STAR Plus',
  'STAR Utsav', 'The Q', 'Zee TV', 'Zee TV HD', 'Zing', 'Zoom',
  '&TV', '&TV HD', 'Shemaroo TV', 'Shemaroo Umang',

  // Hindi Movies
  'Bflix(na)', 'Colors Cineplex Superhits', 'Colors Cineplex Bollywood',
  'Dabangg(na)', 'Goldmines Bollywood', 'Goldmines Movies', 'Anmol Cinema',
  'Anmol Cinema 2', 'Studio One Plus', 'Sun Neo', 'Sun Neo HD',
  'Zee Power', 'Zee Power HD', '&pictures', '&pictures HD', '&Xplor HD',
  'B4U Movies', 'B4U Kadak', 'Colors Cineplex', 'Colors Cineplex HD',
  'Sony MAX 2', 'Sony Wah', 'STAR Gold 2', 'STAR Gold 2 HD',
  'STAR Gold', 'STAR Gold HD', 'STAR Gold Romance', 'STAR Gold Thrills',
  'STAR Gold Select HD', 'STAR Gold Select SD', 'STAR Utsav Movies',
  'Zee Action', 'Zee Bollywood', 'Zee Cinema', 'Zee Cinema HD',
  'Zee Classic', 'Sony MAX1',

  // Hindi News
  'Bharat Express(na)', 'DD News HD', 'News18 Jammu/Kashmir/Ladakh/Himachal',
  '1st India News', 'India TV Speed News HD', 'India Daily 24x7',
  'News 24 Madhyapradesh-Chattisgarh', 'JKL 24x7 News', 'News State Bihar-Jharkhand',
  'ND24- Newsdaily24.in', 'News1 India(na)', 'NL TV', 'NB News(na)',
  'NDTV Rajasthan', 'NDTV Madhya Pradesh-Chhattisgarh',
  'News State Punjab-Haryana-Himachal', 'Swadesh News', 'Good News Today',
  'Vistaar News', 'Zee Rajasthan', 'Zee Bharat', 'Zee Delhi NCR Haryana',
  'News State UP', 'TV 100(na)', 'Aaj Tak', 'Aaj Tak HD', 'ABP News',
  'Bansal News', 'Bharat Samachar', 'News18 Bihar Jharkhand',
  'News18 Madhya Pradesh Chattisgarh', 'News18 Rajasthan',
  'News18 Uttar Pradesh Uttarakhand', 'Gulistan News', 'IBC 24',
  'News18 India', 'India TV', 'INH 24x7', 'Khabar Fast',
  'Khabrain Abhi Tak', 'Living India News', 'Janta TV',
  'News State Madhya Pradesh/Chhattisgarh', 'NDTV India', 'News 24',
  'News Nation', 'Republic Bharat', 'Sudarshan News', 'Swaraj Express SMBC',
  'Total TV', 'TV9 Bharatvarsh', 'Zee Business', 'Zee Madhya Pradesh Chhattisgarh',
  'Zee News', 'Zee Uttar Pradesh Uttarakhand', 'Zee Punjab Haryana Himachal',
  'Zee Bihar Jharkhand',

  // Hindi Kids
  'Super Hungama(v)', 'ETV Bal Bharat SD(v)', 'Nazara',

  // Hindi Music
  'Mastiii(na)', '9X Jalwa', '9XM', 'B4U Music', 'Music India', 'ShowBox',

  // Hindi Sports
  'STAR Sports Khel', 'Sony Sports Ten 5(v)', 'Sony Sports Ten 5 HD(v)',
  'Sony Sports Ten 3 Hindi HD', 'Sony Sports Ten 3 Hindi',
  'STAR Sports 1 Hindi', 'STAR Sports 1 HD Hindi', 'DD Sports',
  'STAR Sports 2 Hindi(v)', 'STAR Sports 2 Hindi HD(v)',
  'Sony Sports Ten 4(v)(na)', 'Sony Sports Ten 4 HD(v)(na)',

  // Hindi Spiritual/Religious
  'OM TV', 'Prarthana Life', 'Satsang', 'Aastha', 'Divya', 'Sanskar',

  // Hindi Business/Lifestyle
  'CNBC Awaaz', 'CNBC Bazar', 'Food Food', 'DD Kisan',

  // Hindi General/Other
  'DD Uttar Pradesh', 'DD Madhya Pradesh', 'DD National', 'DD News', 'DD Rajasthan',

  // Mixed case variants (case-insensitive matching will be handled)
  'All Time Movies', 'Asianet Movies HD', 'Epic TV(v)', 'Animal Planet HD(v)',
  'CBeebies(v)', 'Discovery HD(v)', 'Disney Channel HD(v)'
]);

/**
 * Checks if a channel is a Hindi channel
 */
export function isHindiChannel(channelName: string): boolean {
  return HINDI_CHANNELS.has(channelName);
}

/**
 * Filters out Hindi channels from a channel list for Karnataka and Maharashtra markets
 */
export function filterChannelsForMarket(
  channels: ChannelRecord[],
  market: MarketName
): ChannelRecord[] {
  // Filter Hindi channels for Karnataka and Maharashtra (Rest of Maharashtra)
  // UP is a Hindi-speaking state, so Hindi channels remain there
  if (market === 'Karnataka' || market === 'Maharashtra') {
    return channels.filter(channel => !isHindiChannel(channel.channel));
  }

  // No filtering for other markets (e.g., UP)
  return channels;
}

/**
 * Get count of filtered channels
 */
export function getFilteredChannelCount(
  channels: ChannelRecord[],
  market: MarketName
): { original: number; filtered: number; removed: number } {
  const original = channels.length;
  const filtered = filterChannelsForMarket(channels, market);
  const filteredCount = filtered.length;
  const removed = original - filteredCount;

  return {
    original,
    filtered: filteredCount,
    removed
  };
}

export default {
  isHindiChannel,
  filterChannelsForMarket,
  getFilteredChannelCount
};
