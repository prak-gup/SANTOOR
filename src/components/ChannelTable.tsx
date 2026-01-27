import type { ChannelRecord, MarketName } from '../types';
import {
  formatPercentage,
  formatNumber,
  getGapColor,
  getIndexColor,
  getIndexBadge,
} from '../utils/helpers';

interface ChannelTableProps {
  channels: ChannelRecord[];
  market: MarketName;
  onSort: (field: keyof ChannelRecord) => void;
  sortField: keyof ChannelRecord;
  sortDirection: 'asc' | 'desc';
}

const ChannelTable = ({
  channels,
  market,
  onSort,
  sortField,
  sortDirection,
}: ChannelTableProps) => {
  const isKarnataka = market === 'Karnataka';

  const SortIcon = ({ field }: { field: keyof ChannelRecord }) => {
    if (sortField !== field) {
      return <span className="text-gray-400 ml-1">↕</span>;
    }
    return <span className="text-santoor-orange ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>;
  };

  const renderHeader = (label: string, field: keyof ChannelRecord) => (
    <th
      onClick={() => onSort(field)}
      className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] cursor-pointer hover:bg-slate-50 transition-colors group relative border-b border-slate-100"
    >
      <div className="flex items-center gap-2">
        {label}
        <div className={`transition-all duration-300 ${sortField === field ? 'opacity-100 scale-110' : 'opacity-0 scale-75 group-hover:opacity-40'}`}>
          <SortIcon field={field} />
        </div>
      </div>
      {sortField === field && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-santoor-orange"></div>
      )}
    </th>
  );

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-0">
        <thead>
          <tr className="bg-slate-50/50">
            {renderHeader('Network Entity', 'channel')}
            {renderHeader('Core Genre', 'genre')}
            {renderHeader('Santoor Reach', 'santoorReach')}

            {isKarnataka ? (
              <>
                {renderHeader('Lifebuoy (C)', 'lifebuoyReach')}
                {renderHeader('M.Sandal (C)', 'mysore_sandalReach')}
              </>
            ) : (
              <>
                {renderHeader('Godrej (C)', 'godrejReach')}
                {renderHeader('Lux (C)', 'luxReach')}
              </>
            )}

            {renderHeader('Delta Gap', 'gap')}
            {renderHeader('Comp Index', 'indexVsCompetition')}
            {renderHeader('Base Index', 'indexVsBaseline')}
            <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
              Health Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {channels.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-8 py-20 text-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 9.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-900">No Intelligence Matches</p>
                    <p className="text-xs font-bold text-slate-400">Adjust your focus filters to see more results</p>
                  </div>
                </div>
              </td>
            </tr>
          ) : (
            channels.map((channel, idx) => (
              <tr key={idx} className="hover:bg-slate-50/60 transition-all duration-200 group">
                <td className="px-8 py-6">
                  <div className="flex flex-col">
                    <span className="text-sm font-black text-slate-800 group-hover:text-santoor-orange transition-colors">
                      {channel.channel}
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 font-mono">
                      #{idx + 101}
                    </span>
                  </div>
                </td>
                <td className="px-8 py-6">
                  <span className="px-3 py-1 bg-slate-100 text-[10px] font-black text-slate-500 rounded-lg uppercase tracking-tight group-hover:bg-slate-200 transition-colors">
                    {channel.genre}
                  </span>
                </td>
                <td className="px-8 py-6">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-black text-santoor-orange">
                      {formatPercentage(channel.santoorReach)}
                    </span>
                    <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-santoor-orange transition-all duration-500" 
                        style={{ width: `${Math.min(channel.santoorReach * 2, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </td>

                {isKarnataka ? (
                  <>
                    <td className="px-8 py-6 text-sm font-bold text-slate-500 italic">
                      {formatPercentage(channel.lifebuoyReach || 0)}
                    </td>
                    <td className="px-8 py-6 text-sm font-bold text-slate-500 italic">
                      {formatPercentage(channel.mysore_sandalReach || 0)}
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-8 py-6 text-sm font-bold text-slate-500 italic">
                      {formatPercentage(channel.godrejReach || 0)}
                    </td>
                    <td className="px-8 py-6 text-sm font-bold text-slate-500 italic">
                      {formatPercentage(channel.luxReach || 0)}
                    </td>
                  </>
                )}

                <td className="px-8 py-6">
                  <div className={`flex items-center gap-1.5 text-sm font-black ${getGapColor(channel.gap)}`}>
                    {channel.gap >= 0 ? '+' : ''}{formatPercentage(channel.gap)}
                    {channel.gap >= 0 ? (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                      </svg>
                    ) : (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                    )}
                  </div>
                </td>
                
                <td className="px-8 py-6">
                  <div className={`inline-flex items-center px-3 py-1 rounded-xl font-black text-xs ${getIndexColor(channel.indexVsCompetition)} border-2 border-transparent hover:border-current/20 transition-all`}>
                    {formatNumber(channel.indexVsCompetition)}
                  </div>
                </td>
                
                <td className="px-8 py-6 text-sm font-black text-slate-800">
                  {formatNumber(channel.indexVsBaseline)}
                </td>

                <td className="px-8 py-6">
                  <span className={`inline-flex px-3 py-1 text-[9px] font-black rounded-full uppercase tracking-widest ${getIndexColor(channel.indexVsCompetition)} shadow-sm border border-white`}>
                    {getIndexBadge(channel.indexVsCompetition)}
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default ChannelTable;
