import type { ChannelRecord } from '../types';

export const getIndexColor = (index: number): string => {
  if (index > 150) return 'text-green-700 bg-green-50';
  if (index >= 100) return 'text-green-600 bg-green-50';
  if (index >= 80) return 'text-yellow-700 bg-yellow-50';
  if (index >= 50) return 'text-orange-700 bg-orange-50';
  return 'text-red-700 bg-red-50';
};

export const getIndexBadge = (index: number): string => {
  if (index > 150) return 'DOMINANT';
  if (index >= 100) return 'LEADING';
  if (index >= 80) return 'CLOSE';
  if (index >= 50) return 'BEHIND';
  return 'CRITICAL';
};

export const getGapColor = (gap: number): string => {
  return gap >= 0 ? 'text-green-700' : 'text-red-700';
};

export const getStatusBadgeColor = (status: string): string => {
  switch (status) {
    case 'DOMINANT':
      return 'bg-green-700 text-white';
    case 'LEADING':
      return 'bg-green-600 text-white';
    case 'CLOSE':
      return 'bg-yellow-600 text-white';
    case 'BEHIND':
      return 'bg-orange-600 text-white';
    case 'CRITICAL':
      return 'bg-red-700 text-white';
    default:
      return 'bg-gray-500 text-white';
  }
};

export const formatPercentage = (value: number): string => {
  return `${value.toFixed(1)}%`;
};

export const formatNumber = (value: number, decimals: number = 1): string => {
  return value.toFixed(decimals);
};

export const exportToCSV = (
  data: ChannelRecord[],
  market: string,
  scr: string
): void => {
  if (data.length === 0) return;

  // Determine columns based on market
  const isKarnataka = market === 'Karnataka';

  let headers: string[];
  let rows: string[][];

  if (isKarnataka) {
    headers = [
      'Channel',
      'Genre',
      'Santoor %',
      'Lifebuoy %',
      'M.Sandal %',
      'ATC Index',
      'Gap',
      'Index vs Comp',
      'Index vs Base',
      'Status',
    ];
    rows = data.map((record) => [
      record.channel,
      record.genre,
      formatPercentage(record.santoorReach),
      formatPercentage(record.lifebuoyReach || 0),
      formatPercentage(record.mysore_sandalReach || 0),
      formatNumber(record.atcIndex || 0),
      formatPercentage(record.gap),
      formatNumber(record.indexVsCompetition),
      formatNumber(record.indexVsBaseline),
      getIndexBadge(record.indexVsCompetition),
    ]);
  } else {
    headers = [
      'Channel',
      'Genre',
      'Santoor %',
      'Godrej %',
      'Lux %',
      'Gap',
      'Index vs Comp',
      'Index vs Base',
      'Status',
    ];
    rows = data.map((record) => [
      record.channel,
      record.genre,
      formatPercentage(record.santoorReach),
      formatPercentage(record.godrejReach || 0),
      formatPercentage(record.luxReach || 0),
      formatPercentage(record.gap),
      formatNumber(record.indexVsCompetition),
      formatNumber(record.indexVsBaseline),
      getIndexBadge(record.indexVsCompetition),
    ]);
  }

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', `santoor_${market}_${scr}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
