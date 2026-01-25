import type { MarketName } from '../types';

interface MarketSelectorProps {
  selectedMarket: MarketName;
  onMarketChange: (market: MarketName) => void;
}

const MarketSelector = ({ selectedMarket, onMarketChange }: MarketSelectorProps) => {
  const markets: MarketName[] = ['UP', 'Maharashtra', 'Karnataka'];

  const marketDisplayNames: Record<MarketName, string> = {
    'UP': 'UP',
    'Maharashtra': 'Rest of Maharashtra',
    'Karnataka': 'Karnataka'
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Select Territory</label>
        <span className="w-2 h-2 bg-santoor-orange rounded-full animate-pulse"></span>
      </div>
      <div className="flex flex-col gap-2">
        {markets.map((market) => (
          <button
            key={market}
            onClick={() => onMarketChange(market)}
            className={`group relative px-6 py-4 rounded-2xl text-sm font-black transition-all duration-300 flex items-center justify-between overflow-hidden ${
              selectedMarket === market
                ? 'bg-slate-50 text-slate-900 border border-slate-200'
                : 'bg-transparent text-slate-400 border border-transparent hover:bg-slate-50/50'
            }`}
          >
            {selectedMarket === market && (
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#FF6B00]"></div>
            )}
            <span className="relative z-10">{marketDisplayNames[market]}</span>
            <div className={`transition-all duration-300 ${selectedMarket === market ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0'}`}>
              <svg className="w-5 h-5 text-santoor-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default MarketSelector;
