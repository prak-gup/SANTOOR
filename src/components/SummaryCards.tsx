import type { SCRSummary } from '../types';
import { getStatusBadgeColor, formatNumber } from '../utils/helpers';

interface SummaryCardsProps {
  summary: SCRSummary;
  showATC: boolean;
}

const SummaryCards = ({ summary, showATC }: SummaryCardsProps) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <div className="card-premium p-8 card-premium-hover border-l-4 border-l-slate-200">
        <div className="stat-label">Network Scope</div>
        <div className="stat-value">{summary.totalChannels}</div>
        <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase">Total Analyzed Channels</p>
      </div>

      <div className="card-premium p-8 card-premium-hover border-l-4 border-l-[#FF6B00]">
        <div className="stat-label">Santoor Presence</div>
        <div className="stat-value text-[#FF6B00]">{summary.santoorChannels}</div>
        <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase">Active Placements</p>
      </div>

      <div className="card-premium p-8 card-premium-hover border-l-4 border-l-indigo-500">
        <div className="stat-label">White Space</div>
        <div className="stat-value text-indigo-600">{summary.opportunities}</div>
        <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase">Growth Opportunities</p>
      </div>

      <div className="card-premium p-8 card-premium-hover border-l-4 border-l-emerald-500 col-span-1 sm:col-span-2 lg:col-span-1">
        <div className="stat-label">Efficiency Gap</div>
        <div className="flex items-baseline gap-3">
          <div className={`stat-value ${summary.avgGap >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {formatNumber(summary.avgGap, 1)}%
          </div>
          <span className={`px-2.5 py-0.5 text-[9px] font-black rounded-full uppercase tracking-widest ${getStatusBadgeColor(summary.status)}`}>
            {summary.status}
          </span>
        </div>
        <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase text-emerald-600">Performance vs Benchmark</p>
      </div>

      {showATC && summary.avgAtcIndex !== undefined && (
        <div className="card-premium p-8 card-premium-hover border-l-4 border-l-purple-500">
          <div className="stat-label">ATC Momentum</div>
          <div className="stat-value text-purple-600">{formatNumber(summary.avgAtcIndex, 1)}</div>
          <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase text-purple-600">Market Index Velocity</p>
        </div>
      )}
    </div>
  );
};

export default SummaryCards;
