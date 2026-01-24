interface SCRSelectorProps {
  scrs: string[];
  selectedSCR: string;
  onSCRChange: (scr: string) => void;
}

const SCRSelector = ({ scrs, selectedSCR, onSCRChange }: SCRSelectorProps) => {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">Regional Focus (SCR)</label>
        <div className="px-2 py-0.5 bg-white/10 rounded text-[9px] font-black text-white/40 uppercase tracking-widest font-mono text-right">
          Geo-Spatial Focus
        </div>
      </div>
      <div className="flex flex-wrap gap-2.5">
        {scrs.map((scr) => (
          <button
            key={scr}
            onClick={() => onSCRChange(scr)}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all duration-300 border-2 ${
              selectedSCR === scr
                ? 'bg-[#FF6B00] border-[#FF6B00] text-white shadow-lg shadow-orange-500/20 scale-105'
                : 'bg-transparent border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-300'
            }`}
          >
            {scr}
          </button>
        ))}
      </div>
    </div>
  );
};

export default SCRSelector;
