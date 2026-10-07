import { useState, useMemo, useEffect, Fragment } from 'react';
import '@fontsource/dm-mono/400.css';
import '@fontsource/dm-mono/500.css';
import '@fontsource/outfit/400.css';
import '@fontsource/outfit/600.css';
import '@fontsource/outfit/700.css';
import data from './data/santoor_multimarket_data.json';
import districtData from './data/up_district_data.json';
import {
  filterRelevantChannels,
  calculateStatus,
} from './utils/optimization';
import { computeScenario, DEFAULT_LEVERS } from './utils/scenario';
import { MIN_COMP_REF } from './utils/dataAudit';
import type { MarketKey } from './utils/dataAudit';
import ScenarioKpis from './components/ScenarioKpis';
import IndicativeScenarioPanel from './components/IndicativeScenarioPanel';
import type { ChannelRecord, TimebandMetrics } from './types';
import TabNavigation from './components/TabNavigation';
import TimebandHeatmap from './components/TimebandHeatmap';
import PlannerInsightsSummary from './components/PlannerInsightsSummary';
import DistrictSelector from './components/DistrictSelector';
import DistrictSummaryCards from './components/DistrictSummaryCards';
import { generateSampleTimebandData, enrichChannelWithTimebands, TIMEBAND_DISPLAY_V2 } from './utils/timebandProcessor';
import { getTimebandStatus, getTimebandRecommendation } from './utils/timebandAnalysis';
import { generateSimplifiedInsights } from './utils/plannerInsights';
import { filterChannelsForMarket } from './utils/channelLanguageFilter';
import {
  calculateDistrictChannels,
  calculateDistrictSummary,
  getDistrictsForSer,
  SER_TO_SCR_KEY,
} from './utils/districtCalculations';
import type { DistrictRecord } from './utils/districtCalculations';
import { useTheme } from './hooks/useTheme';
import ThemeToggle from './components/ThemeToggle';
import wppLogo from './assets/wpp-logo.svg';
import syncLogo from './assets/sync-logo.svg';

type MarketName = string;

interface MarketData {
  scrs: string[];
  competitors: string[];
  optimizationType: string;
  marketShare: Record<string, number>;
  summaries: Record<string, unknown>;
  channelData: Record<string, ChannelRecord[]>;
}

interface SantoorData {
  metadata: { markets: string[] };
  markets: Record<string, MarketData>;
}

const santoorData = data as SantoorData;

const REC_ICONS: Record<string, string> = {
  'INCREASE': '↑',
  'MAINTAIN': '—',
  'ADD': '+',
  'DECREASE': '↓'
};

const STATUS_CLASSES: Record<string, string> = {
  'LEADING': 'signal-badge signal-positive',
  'CLOSE': 'signal-badge signal-warning',
  'BEHIND': 'signal-badge signal-negative',
  'CRITICAL': 'signal-badge signal-negative',
  'OPPORTUNITY': 'signal-badge signal-purple',
  'MONOPOLY': 'signal-badge signal-info'
};

const REC_CLASSES: Record<string, string> = {
  'INCREASE': 'signal-badge signal-positive',
  'MAINTAIN': 'signal-badge signal-info',
  'ADD': 'signal-badge signal-purple',
  'DECREASE': 'signal-badge signal-negative'
};

// Info Button Component with Tooltip
interface InfoButtonProps {
  isActive: boolean;
  onClick: () => void;
  children: React.ReactNode;
  position?: 'left' | 'right' | 'auto'; // Position of tooltip
}

function InfoButton({ isActive, onClick, children, position = 'auto' }: InfoButtonProps) {
  // In 'auto' mode, flip the tooltip to the right edge when it would overflow the viewport.
  // Done on mount of the tooltip node, without React state.
  const positionTooltip = (el: HTMLDivElement | null) => {
    if (el && position === 'auto' && el.getBoundingClientRect().right > window.innerWidth - 20) {
      el.style.left = 'auto';
      el.style.right = '0';
    }
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        style={{
          marginLeft: '6px',
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          border: '1px solid var(--orange-bright)',
          background: isActive ? 'var(--orange-bright)' : 'transparent',
          color: isActive ? 'white' : 'var(--orange-bright)',
          fontSize: '10px',
          fontFamily: 'DM Mono, monospace',
          fontWeight: '500',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease'
        }}
        onMouseEnter={(e) => {
          if (!isActive) {
            e.currentTarget.style.background = 'rgba(255,87,34,0.1)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive) {
            e.currentTarget.style.background = 'transparent';
          }
        }}
      >
        i
      </button>
      {isActive && (
        <div
          ref={positionTooltip}
          style={{
            position: 'absolute',
            top: '24px',
            ...(position === 'right' ? { right: '0' } : { left: '0' }),
            zIndex: 1000,
            background: 'var(--surface-1)',
            border: '2px solid var(--orange-bright)',
            borderRadius: '8px',
            padding: '16px',
            minWidth: '320px',
            maxWidth: '420px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
            fontSize: '11px',
            lineHeight: '1.5',
            overflowWrap: 'break-word',
            wordWrap: 'break-word',
            wordBreak: 'normal',
            color: 'var(--text-primary)'
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}


const SAMPLE_BANNER_STYLE: React.CSSProperties = {
  padding: '12px 16px',
  marginBottom: '16px',
  borderRadius: '8px',
  border: '1px solid var(--signal-warning)',
  background: 'var(--surface-2)',
  color: 'var(--signal-warning)',
  fontFamily: 'DM Mono, monospace',
  fontSize: '12px',
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
};

function SampleDataBanner() {
  return (
    <div role="alert" style={SAMPLE_BANNER_STYLE}>
      Illustrative sample data: timeband figures are generated, not measured. Do not use in client material.
    </div>
  );
}

type SortableRow = Record<string, number | string | undefined>;

// Market display names
const MARKET_DISPLAY_NAMES: Record<MarketName, string> = {
  'UP': 'UP',
  'Maharashtra': 'Rest of Maharashtra',
  'Karnataka': 'Karnataka'
};

// Reverse mapping: display name -> internal market value
const DISPLAY_TO_MARKET: Record<string, MarketName> = {
  'UP': 'UP',
  'Rest of Maharashtra': 'Maharashtra',
  'Karnataka': 'Karnataka'
};

export default function App() {
  // Theme state
  const { theme, toggleTheme } = useTheme();

  // Tab navigation state
  const [activeTab, setActiveTab] = useState<'channel' | 'timeband' | 'district'>('channel');

  // District analysis state (UP market only)
  const [selectedDistrictSer, setSelectedDistrictSer] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [districtSubTab, setDistrictSubTab] = useState<'channels' | 'timebands'>('channels');

  const allDistricts: DistrictRecord[] = districtData.districts as DistrictRecord[];

  // Core state - initialize from URL if available
  const getInitialMarket = (): MarketName => {
    const params = new URLSearchParams(window.location.search);
    const marketFromUrl = params.get('market');
    if (marketFromUrl) {
      const decoded = decodeURIComponent(marketFromUrl);
      return DISPLAY_TO_MARKET[decoded] || 'Maharashtra';
    }
    return 'Maharashtra';
  };
  const [market, setMarket] = useState<MarketName>(getInitialMarket());
  const [scr, setSCR] = useState<string>(() => `${getInitialMarket()} Overall`);
  const [intensity, setIntensity] = useState<number>(DEFAULT_LEVERS.intensity);
  const [threshold, setThreshold] = useState<number>(DEFAULT_LEVERS.threshold);
  const [showAll, setShowAll] = useState<boolean>(false);
  const [genre, setGenre] = useState<string>('All');
  const [search, setSearch] = useState<string>('');
  const [sortCol, setSortCol] = useState<string>('santoorReach');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  // Timeband data is synthetic (generateSampleTimebandData). It is only reachable with ?debug=1.
  const [debug] = useState<boolean>(() => new URLSearchParams(window.location.search).get('debug') === '1');

  // Timeband state (only for timeband tab)
  const [selectedTimeband] = useState<string>('all');
  const [expandedChannel, setExpandedChannel] = useState<string | null>(null);
  const [heatmapMetric, setHeatmapMetric] = useState<'reach' | 'gap' | 'atcIndex'>('reach');
  const [selectedChannelForInsights, setSelectedChannelForInsights] = useState<string | null>(null);

  const marketData = santoorData.markets[market];
  const scrs = useMemo(() => marketData?.scrs || [], [marketData]);
  const competitors = marketData?.competitors || [];
  const optType = marketData?.optimizationType || 'Reach';
  const rawChannels = useMemo<ChannelRecord[]>(
    () => filterChannelsForMarket(marketData?.channelData[scr] || [], market as MarketKey),
    [marketData, scr, market]
  );

  // All channels of the selected market / SCR. Timeband enrichment is synthetic sample data,
  // so it is only attached in debug mode.
  const enrichedChannels = useMemo(() => {
    if (!debug) return rawChannels;
    return rawChannels.map(channel => {
      if (channel.timebands && channel.timebands.length > 0) return channel;
      return enrichChannelWithTimebands(channel, generateSampleTimebandData(channel, market));
    });
  }, [rawChannels, market, debug]);

  // Update URL when market changes
  useEffect(() => {
    const displayName = MARKET_DISPLAY_NAMES[market];
    const params = new URLSearchParams(window.location.search);
    params.set('market', encodeURIComponent(displayName));
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({}, '', newUrl);
  }, [market]);

  // Switching market resets the SCR, drops UP-only district state and falls back from tabs that do not apply.
  const handleMarketChange = (next: MarketName) => {
    const nextScrs = santoorData.markets[next]?.scrs || [];
    const def = `${next} Overall`;
    setMarket(next);
    setSCR(nextScrs.includes(def) ? def : nextScrs[0] ?? '');
    if (next !== 'UP') {
      setSelectedDistrictSer(null);
      setSelectedDistrict(null);
      if (activeTab === 'district') setActiveTab('channel');
    }
  };
  const visibleTab: 'channel' | 'timeband' | 'district' =
    (activeTab === 'timeband' && !debug) || (activeTab === 'district' && market !== 'UP') ? 'channel' : activeTab;

  // District-level computation
  const districtComputed = useMemo(() => {
    if (market !== 'UP' || !selectedDistrictSer || !selectedDistrict) return null;

    const district = allDistricts.find(d => d.ser === selectedDistrictSer && d.district === selectedDistrict);
    if (!district) return null;

    const scrKey = SER_TO_SCR_KEY[selectedDistrictSer] || selectedDistrictSer;
    const serChannelData: ChannelRecord[] = santoorData.markets['UP']?.channelData[scrKey] || [];
    if (serChannelData.length === 0) return null;

    const serDistricts = getDistrictsForSer(allDistricts, scrKey);

    // Enrich SER channels with timeband data first
    const enrichedSerChannels = serChannelData.map(channel => {
      if (!debug || (channel.timebands && channel.timebands.length > 0)) return channel;
      const sampleTimebands = generateSampleTimebandData(channel, 'UP');
      return enrichChannelWithTimebands(channel, sampleTimebands);
    });

    // Scale to district level
    const districtChannels = calculateDistrictChannels(enrichedSerChannels, district, serDistricts);
    const summary = calculateDistrictSummary(district, districtChannels);

    // Filter for display (same logic as main view)
    const filtered = filterRelevantChannels(districtChannels, 'actionable') as ChannelRecord[];

    return { district, districtChannels, filtered, summary };
  }, [market, selectedDistrictSer, selectedDistrict, allDistricts, debug]);

  const genres = useMemo(() => ['All', ...new Set(enrichedChannels.map(c => c.genre))], [enrichedChannels]);

  const displayChannels = useMemo(() => {
    let filtered: ChannelRecord[] = showAll ? enrichedChannels : filterRelevantChannels(enrichedChannels, 'actionable') as ChannelRecord[];
    if (genre !== 'All') filtered = filtered.filter(c => c.genre === genre);
    if (search) filtered = filtered.filter(c => c.channel.toLowerCase().includes(search.toLowerCase()));

    // Filter by timeband only when in timeband tab
    if (activeTab === 'timeband' && selectedTimeband !== 'all') {
      filtered = filtered.filter(ch => {
        if (!ch.timebands) return false;
        const tb = ch.timebands.find((t: TimebandMetrics) => t.timeband === selectedTimeband);
        return tb && tb.santoorReach > 0;
      });
    }

    return [...filtered].sort((a, b) => {
      const aV = (a as unknown as SortableRow)[sortCol] ?? 0, bV = (b as unknown as SortableRow)[sortCol] ?? 0;
      return sortDir === 'asc' ? (aV > bV ? 1 : -1) : (aV < bV ? 1 : -1);
    });
  }, [enrichedChannels, showAll, genre, search, sortCol, sortDir, selectedTimeband, activeTab]);

  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('button') && !target.closest('[style*="position: absolute"]')) {
        setActiveTooltip(null);
      }
    };

    if (activeTooltip) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [activeTooltip]);

  // Calculate propensity metrics for Karnataka market
  const propensityMetrics = useMemo(() => {
    if (market !== 'Karnataka') return null;

    const channelsWithATC = enrichedChannels.filter(c => c.atcIndex && c.santoorReach > 0);
    if (channelsWithATC.length === 0) return null;

    const maxAtcIndex = Math.max(...channelsWithATC.map(c => c.atcIndex || 0));
    const totalWeightedATC = channelsWithATC.reduce((sum, c) => sum + (c.atcIndex || 0) * c.santoorReach, 0);

    return { maxAtcIndex, totalWeightedATC };
  }, [enrichedChannels, market]);

  // Observed baselines. These never depend on the levers.
  const summary = useMemo(() => {
    const rel = filterRelevantChannels(enrichedChannels);
    const withS = rel.filter(c => c.santoorReach > 0);
    const opp = rel.filter(c => c.santoorReach === 0 && c.maxCompReach >= 2.0 && c.channelShare >= 1.0);
    const avgGap = withS.length ? withS.reduce((s, c) => s + c.gap, 0) / withS.length : 0;
    const avgATC = market === 'Karnataka' && withS.length ? withS.reduce((s, c) => s + (c.atcIndex || 0), 0) / withS.length : null;
    return {
      total: enrichedChannels.length,
      rel: rel.length,
      active: withS.length,
      opp: opp.length,
      avgGap,
      avgATC,
      status: avgGap >= 2 ? 'LEADING' : avgGap >= 0 ? 'CLOSE' : avgGap >= -2 ? 'BEHIND' : 'CRITICAL'
    };
  }, [enrichedChannels, market]);

  // Everything the levers drive, derived from ALL channels of the market / SCR.
  // Search, genre, sort and "show all" only change the table, never these numbers.
  const scenario = useMemo(
    () => computeScenario(enrichedChannels, market as MarketKey, { intensity, threshold }),
    [enrichedChannels, market, intensity, threshold]
  );

  const resetLevers = () => {
    setIntensity(DEFAULT_LEVERS.intensity);
    setThreshold(DEFAULT_LEVERS.threshold);
  };

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  };

  const getComp = (ch: ChannelRecord, i: number) => {
    if (i === 0) return ch.godrejReach ?? ch.lifebuoyReach ?? 0;
    return ch.luxReach ?? ch.mysore_sandalReach ?? 0;
  };

  return (
    <div className="min-h-screen" style={{ padding: '40px 20px' }}>
      <div className="max-w-[1400px] mx-auto">

        {/* HEADER - Command Center Style */}
        <div className="panel" style={{ marginBottom: '48px' }}>
          <div className="p-8 relative" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="absolute top-0 left-0 w-1 h-full" style={{
              background: 'linear-gradient(180deg, var(--orange-bright), var(--orange-dim))',
              boxShadow: 'var(--glow-orange)'
            }}></div>

            {/* Left: Title */}
            <div className="pl-6">
              <h1 style={{
                fontFamily: 'Outfit, sans-serif',
                fontSize: '32px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginBottom: '8px',
                letterSpacing: '-0.02em'
              }}>
                SANTOOR // TV OPTIMIZER
              </h1>
              <p style={{
                fontFamily: 'DM Mono, monospace',
                fontSize: '13px',
                color: 'var(--text-tertiary)',
                letterSpacing: '0.03em'
              }}>
                MULTI-MARKET CAMPAIGN ANALYSIS & OPTIMIZATION PLATFORM
              </p>
            </div>

            {/* Right: Logos and Theme Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
              {/* Company Logos */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <img src={wppLogo} alt="WPP" style={{ height: '40px' }} />
                <span style={{
                  fontSize: '24px',
                  color: 'var(--text-tertiary)',
                  fontWeight: 300,
                  userSelect: 'none'
                }}>+</span>
                <img src={syncLogo} alt="SYNC" style={{ height: '40px' }} />
              </div>

              {/* Theme Toggle */}
              <ThemeToggle theme={theme} onToggle={toggleTheme} />
            </div>
          </div>
        </div>

        {/* MARKET & SCR SELECTOR */}
        <div className="panel" style={{ marginBottom: '48px' }}>
          <div className="p-6">
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label style={{
                  fontFamily: 'Outfit, sans-serif',
                  fontSize: '12px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--text-tertiary)'
                }}>
                  MARKET
                </label>
                <select
                  value={market}
                  onChange={e => handleMarketChange(e.target.value as MarketName)}
                  style={{ minWidth: '180px' }}
                >
                  {santoorData.metadata.markets.map(m => <option key={m} value={m}>{MARKET_DISPLAY_NAMES[m as MarketName]}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flex: 1 }}>
                {scrs.map(s => (
                  <button
                    key={s}
                    onClick={() => setSCR(s)}
                    className={`btn-tactical ${scr === s ? 'active' : ''}`}
                  >
                    {s.replace(market + ' ', '').replace('Overall', 'ALL')}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* TAB NAVIGATION */}
        <TabNavigation
          activeTab={visibleTab}
          onTabChange={setActiveTab}
          showDistrictTab={market === 'UP'}
          showTimebandTab={debug}
        />

        {/* CHANNEL ANALYSIS TAB */}
        {visibleTab === 'channel' && (
          <>
            {/* LIVE LEVERS */}
        <div style={{ marginBottom: '32px' }}>
          <div className="panel">
            <div className="panel-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{
                  fontFamily: 'Outfit, sans-serif',
                  fontSize: '16px',
                  fontWeight: 600,
                  color: 'var(--text-primary)'
                }}>
                  ⚙️ SCENARIO LEVERS
                </span>
                <span className={`signal-badge ${optType === 'ATC' ? 'signal-purple' : 'signal-info'}`}>
                  {optType === 'ATC' ? 'ATC MARKET' : 'REACH MARKET'}
                </span>
              </div>
              <button onClick={resetLevers} className="btn-tactical">
                ↺ RESET LEVERS
              </button>
            </div>
            <div className="p-6" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{
                    fontFamily: 'Outfit, sans-serif',
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--text-tertiary)',
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: '8px'
                  }}>
                    INTENSITY: <span style={{ color: 'var(--orange-bright)', fontSize: '14px', marginLeft: '6px' }}>{intensity}%</span>
                    <InfoButton
                      isActive={activeTooltip === 'intensity'}
                      onClick={() => setActiveTooltip(activeTooltip === 'intensity' ? null : 'intensity')}
                    >
                      <div style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text-primary)' }}>
                        <div style={{ fontWeight: '600', marginBottom: '8px', color: 'var(--orange-bright)', fontSize: '12px' }}>
                          ⚡ INTENSITY
                        </div>
                        <div style={{ marginBottom: '8px', fontSize: '11px', lineHeight: '1.5' }}>
                          Share of the unprotected reach-point weight to reallocate. 0% changes nothing; higher values move more weight from the lowest-return unprotected channels to channels where Santoor trails.
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                          The engine only moves weight while a receiving channel earns more reach than a donor gives up (also under the pessimistic curve), so high intensities can plateau once that headroom is used. The notice under the KPIs says when, with the number.
                        </div>
                      </div>
                    </InfoButton>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={intensity}
                    onChange={e => setIntensity(+e.target.value)}
                    aria-label="Intensity: percent of unprotected reach-point weight to reallocate"
                    style={{ width: '100%' }}
                  />
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: '12px',
                    padding: '0 2px',
                    fontSize: '10px',
                    color: 'var(--text-dim)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em'
                  }}>
                    <span>No change</span>
                    <span>Move more</span>
                  </div>
                </div>
              </div>

              <div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{
                    fontFamily: 'Outfit, sans-serif',
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--text-tertiary)',
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: '8px'
                  }}>
                    THRESHOLD: <span style={{ color: 'var(--orange-bright)', fontSize: '14px', marginLeft: '6px' }}>top {threshold}% protected</span>
                    <InfoButton
                      isActive={activeTooltip === 'threshold'}
                      onClick={() => setActiveTooltip(activeTooltip === 'threshold' ? null : 'threshold')}
                    >
                      <div style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text-primary)' }}>
                        <div style={{ fontWeight: '600', marginBottom: '8px', color: 'var(--orange-bright)', fontSize: '12px' }}>
                          🎯 THRESHOLD
                        </div>
                        <div style={{ marginBottom: '8px', fontSize: '11px', lineHeight: '1.5' }}>
                          The top X% of Santoor-active channels, ranked by Santoor reach, are frozen before any rule runs. Protected channels are never cut, but can still receive weight where Santoor trails.
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                          Higher = more channels frozen, fewer donors, fewer changes. Because it counts channels, not weight, a 70% threshold usually freezes 85-95% of the reach-point weight; the default is 30%.
                        </div>
                      </div>
                    </InfoButton>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={threshold}
                    onChange={e => setThreshold(+e.target.value)}
                    aria-label="Threshold: top percent of Santoor channels by reach that are protected"
                    style={{ width: '100%' }}
                  />
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: '12px',
                    padding: '0 2px',
                    fontSize: '10px',
                    color: 'var(--text-dim)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em'
                  }}>
                    <span>Nothing frozen</span>
                    <span>All frozen</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* LAYER 1: LIVE DECISION KPIs */}
        <ScenarioKpis scenario={scenario} baseline={summary} statusClasses={STATUS_CLASSES} />

        {/* LAYER 2: INDICATIVE, MODELLED */}
        <IndicativeScenarioPanel scenario={scenario} />

        {/* FILTERS */}
        <div className="panel mb-6">
          <div className="p-5">
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <select value={genre} onChange={e => setGenre(e.target.value)} style={{ minWidth: '150px' }}>
                {genres.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="SEARCH CHANNELS..."
                style={{ flex: 1, minWidth: '200px' }}
              />
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={showAll}
                  onChange={e => setShowAll(e.target.checked)}
                />
                <span style={{
                  fontFamily: 'DM Mono, monospace',
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em'
                }}>
                  {showAll
                    ? `SHOWING ALL CHANNELS (${displayChannels.length})`
                    : `ACTIONABLE CHANNELS (${displayChannels.length}) - >1% REACH OR REAL OPPORTUNITIES`
                  }
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* DATA TABLE */}
        <div className="panel">
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  {[
                    { key: 'channel', label: 'CHANNEL' },
                    { key: 'genre', label: 'GENRE' },
                    { key: 'santoorReach', label: 'SANTOOR' },
                    { key: 'comp1', label: competitors[0]?.toUpperCase() || 'COMP 1' },
                    { key: 'comp2', label: competitors[1]?.toUpperCase().replace('_', ' ') || 'COMP 2' },
                    ...(market === 'Karnataka' ? [
                      { key: 'propensity', label: 'PROPENSITY %' },
                      { key: 'atcContribution', label: 'ATC CONTRIB %' }
                    ] : []),
                    { key: 'gap', label: 'GAP' },
                    { key: 'indexVsCompetition', label: 'INDEX' },
                    { key: 'status', label: 'STATUS' },
                    { key: 'rec', label: 'ACTION' },
                    { key: 'reason', label: 'REASON' }
                  ].map(col => (
                    <th
                      key={col.key}
                      onClick={() => !['status', 'rec', 'reason', 'comp1', 'comp2'].includes(col.key) && handleSort(col.key)}
                      className={!['status', 'rec', 'reason', 'comp1', 'comp2'].includes(col.key) ? 'sortable' : ''}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                        {col.label}
                        {sortCol === col.key && (
                          <span style={{ color: 'var(--orange-bright)', fontSize: '14px' }}>
                            {sortDir === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                        {col.key === 'status' && (
                          <InfoButton
                            isActive={activeTooltip === 'status'}
                            onClick={() => setActiveTooltip(activeTooltip === 'status' ? null : 'status')}
                          >
                            <div style={{ fontFamily: 'DM Mono, monospace' }}>
                              <div style={{ fontWeight: '600', marginBottom: '12px', color: 'var(--orange-bright)', fontSize: '12px' }}>
                                📊 CHANNEL STATUS LEGEND
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span className="signal-badge signal-positive" style={{ minWidth: '72px', fontSize: '9px' }}>🏆 DOMINANT</span>
                                  <span style={{ color: 'var(--text-secondary)' }}>Index ≥150% vs competition</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span className="signal-badge signal-positive" style={{ minWidth: '72px', fontSize: '9px' }}>↑ LEADING</span>
                                  <span style={{ color: 'var(--text-secondary)' }}>Index 100-149%</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span className="signal-badge signal-warning" style={{ minWidth: '72px', fontSize: '9px' }}>~ CLOSE</span>
                                  <span style={{ color: 'var(--text-secondary)' }}>Index 80-99%</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span className="signal-badge signal-negative" style={{ minWidth: '72px', fontSize: '9px' }}>↓ BEHIND</span>
                                  <span style={{ color: 'var(--text-secondary)' }}>Index 50-79%</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span className="signal-badge signal-negative" style={{ minWidth: '72px', fontSize: '9px' }}>⚠ CRITICAL</span>
                                  <span style={{ color: 'var(--text-secondary)' }}>Index &lt;50%</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span className="signal-badge signal-purple" style={{ minWidth: '72px', fontSize: '9px' }}>+ OPPORTUNITY</span>
                                  <span style={{ color: 'var(--text-secondary)' }}>Santoor 0%, Comp ≥2%</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span className="signal-badge signal-info" style={{ minWidth: '72px', fontSize: '9px' }}>★ MONOPOLY</span>
                                  <span style={{ color: 'var(--text-secondary)' }}>Only Santoor present</span>
                                </div>
                              </div>
                            </div>
                          </InfoButton>
                        )}
                        {col.key === 'indexVsCompetition' && (
                          <InfoButton
                            isActive={activeTooltip === 'index'}
                            onClick={() => setActiveTooltip(activeTooltip === 'index' ? null : 'index')}
                          >
                            <div style={{ fontFamily: 'DM Mono, monospace', width: '100%' }}>
                              <div style={{ fontWeight: '600', marginBottom: '8px', color: 'var(--orange-bright)', fontSize: '12px' }}>
                                📈 INDEX EXPLAINED
                              </div>
                              <div style={{ margin: '0 0 12px 0', color: 'var(--text-primary)', fontSize: '11px', lineHeight: '1.6' }}>
                                <strong>Index = (Santoor / Competitor) × 100</strong>
                              </div>
                              <div style={{ color: 'var(--text-secondary)', marginBottom: '12px', fontSize: '10px', lineHeight: '1.5' }}>
                                <div style={{ marginBottom: '4px' }}>• <strong>Index &gt; 100</strong>: Santoor outperforms</div>
                                <div style={{ marginBottom: '4px' }}>• <strong>Index = 100</strong>: Equal to competitor</div>
                                <div style={{ marginBottom: '4px' }}>• <strong>Index &lt; 100</strong>: Lagging behind</div>
                              </div>
                              <div style={{
                                background: 'rgba(255,87,34,0.05)',
                                padding: '8px',
                                borderRadius: '4px',
                                borderLeft: '3px solid var(--orange-bright)',
                                fontSize: '10px',
                                lineHeight: '1.5',
                                wordBreak: 'break-word'
                              }}>
                                <div><strong>Example:</strong></div>
                                <div>Santoor 5% vs Comp 10%</div>
                                <div>= Index 50 (CRITICAL)</div>
                              </div>
                            </div>
                          </InfoButton>
                        )}
                        {col.key === 'propensity' && (
                          <InfoButton
                            isActive={activeTooltip === 'propensity'}
                            onClick={() => setActiveTooltip(activeTooltip === 'propensity' ? null : 'propensity')}
                          >
                            <div style={{ fontFamily: 'DM Mono, monospace', width: '100%' }}>
                              <div style={{ fontWeight: '600', marginBottom: '8px', color: 'var(--orange-bright)', fontSize: '12px' }}>
                                🎯 PROPENSITY SCORE
                              </div>
                              <div style={{ marginBottom: '8px', fontSize: '11px', lineHeight: '1.5', color: 'var(--text-primary)' }}>
                                Likelihood of ATC conversion relative to reach, normalized 0-100%
                              </div>
                              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                                <div style={{ marginBottom: '4px' }}>• <strong>&gt;70%</strong>: High propensity - efficient ATC driver</div>
                                <div style={{ marginBottom: '4px' }}>• <strong>40-70%</strong>: Medium propensity</div>
                                <div>• <strong>&lt;40%</strong>: Low propensity - reach without conversion</div>
                              </div>
                            </div>
                          </InfoButton>
                        )}
                        {col.key === 'atcContribution' && (
                          <InfoButton
                            isActive={activeTooltip === 'atcContribution'}
                            onClick={() => setActiveTooltip(activeTooltip === 'atcContribution' ? null : 'atcContribution')}
                          >
                            <div style={{ fontFamily: 'DM Mono, monospace', width: '100%' }}>
                              <div style={{ fontWeight: '600', marginBottom: '8px', color: 'var(--orange-bright)', fontSize: '12px' }}>
                                📊 ATC CONTRIBUTION
                              </div>
                              <div style={{ marginBottom: '8px', fontSize: '11px', lineHeight: '1.5', color: 'var(--text-primary)' }}>
                                This channel's share of total ATC impact across all channels
                              </div>
                              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                                Formula: (Channel ATC × Reach) / Total Weighted ATC × 100
                              </div>
                            </div>
                          </InfoButton>
                        )}
                        {col.key === 'rec' && (
                          <InfoButton
                            isActive={activeTooltip === 'action'}
                            onClick={() => setActiveTooltip(activeTooltip === 'action' ? null : 'action')}
                          >
                            <div style={{ fontFamily: 'DM Mono, monospace', width: '100%' }}>
                              <div style={{ fontWeight: '600', marginBottom: '12px', color: 'var(--orange-bright)', fontSize: '12px' }}>
                                🎯 RECOMMENDED ACTIONS
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                  <span className="signal-badge signal-positive" style={{ minWidth: '68px', fontSize: '9px', flexShrink: 0 }}>↑ INCREASE</span>
                                  <span style={{ color: 'var(--text-secondary)', fontSize: '10px', lineHeight: '1.4' }}>Boost spend - lagging competition</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                  <span className="signal-badge signal-purple" style={{ minWidth: '68px', fontSize: '9px', flexShrink: 0 }}>+ ADD</span>
                                  <span style={{ color: 'var(--text-secondary)', fontSize: '10px', lineHeight: '1.4' }}>Enter new untapped channel</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                  <span className="signal-badge signal-info" style={{ minWidth: '68px', fontSize: '9px', flexShrink: 0 }}>— MAINTAIN</span>
                                  <span style={{ color: 'var(--text-secondary)', fontSize: '10px', lineHeight: '1.4' }}>Keep current spend level</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                  <span className="signal-badge signal-negative" style={{ minWidth: '68px', fontSize: '9px', flexShrink: 0 }}>↓ DECREASE</span>
                                  <span style={{ color: 'var(--text-secondary)', fontSize: '10px', lineHeight: '1.4' }}>Reduce and reallocate</span>
                                </div>
                              </div>
                              <div style={{
                                background: 'rgba(255,87,34,0.05)',
                                padding: '8px',
                                borderRadius: '4px',
                                borderLeft: '3px solid var(--orange-bright)',
                                fontSize: '10px',
                                lineHeight: '1.5',
                                wordBreak: 'break-word'
                              }}>
                                <div><strong>💡 Strategy:</strong></div>
                                <div>Move budget from DECREASE to INCREASE/ADD channels</div>
                              </div>
                            </div>
                          </InfoButton>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayChannels.map((ch, i) => {
                  const st = calculateStatus(ch);
                  const opt = scenario.outcomes.get(ch.channel);

                  return (
                    <>
                      <tr
                        key={i}
                        style={{
                          background: 'transparent'
                        }}
                      >
                        <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                          {ch.channel}
                        </td>
                      <td style={{ color: 'var(--text-tertiary)' }}>{ch.genre}</td>
                      <td style={{ fontWeight: 600, color: 'var(--orange-bright)', textAlign: 'right' }}>
                        {ch.santoorReach.toFixed(1)}%
                      </td>
                      <td style={{ textAlign: 'right' }}>{getComp(ch, 0).toFixed(1)}%</td>
                      <td style={{ textAlign: 'right' }}>{getComp(ch, 1).toFixed(1)}%</td>
                      {market === 'Karnataka' && (
                        <>
                          <td style={{ textAlign: 'right' }}>
                            {(() => {
                              if (!propensityMetrics || !ch.atcIndex) return '-';
                              const propensity = Math.min(100, (ch.atcIndex / propensityMetrics.maxAtcIndex) * 100);
                              const color = propensity >= 70 ? 'var(--signal-positive)' : propensity >= 40 ? 'var(--signal-warning)' : 'var(--signal-negative)';
                              return (
                                <span style={{ color, fontWeight: 600 }}>
                                  {propensity.toFixed(1)}%
                                </span>
                              );
                            })()}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {(() => {
                              if (!propensityMetrics || !ch.atcIndex || ch.santoorReach === 0) return '-';
                              const contribution = (ch.atcIndex * ch.santoorReach) / propensityMetrics.totalWeightedATC * 100;
                              return (
                                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                                  {contribution.toFixed(1)}%
                                </span>
                              );
                            })()}
                          </td>
                        </>
                      )}
                      <td style={{
                        fontWeight: 600,
                        color: ch.gap >= 0 ? 'var(--signal-positive)' : 'var(--signal-negative)',
                        textAlign: 'right'
                      }}>
                        {ch.gap >= 0 ? '+' : ''}{ch.gap.toFixed(1)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {ch.maxCompReach >= MIN_COMP_REF ? ch.indexVsCompetition.toFixed(0) : 'n/a'}
                      </td>
                      <td>
                        <span className={STATUS_CLASSES[st] || 'signal-badge signal-neutral'}>
                          {st}
                        </span>
                      </td>
                      <td>
                        {opt ? (
                          <span className={REC_CLASSES[opt.action] || 'signal-badge signal-neutral'}>
                            {REC_ICONS[opt.action]} {opt.action}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-dim)' }}>—</span>
                        )}
                        {opt?.isProtected && (
                          <span className="signal-badge signal-neutral" style={{ marginLeft: '6px' }}>PROTECTED</span>
                        )}
                      </td>
                      <td style={{
                        color: 'var(--text-tertiary)',
                        fontSize: '12px',
                        minWidth: '260px',
                        maxWidth: '380px',
                        whiteSpace: 'normal',
                        lineHeight: '1.4',
                        wordBreak: 'break-word'
                      }}>
                        {opt?.reason || 'Outside the actionable set (see "Show all"): not part of the scenario.'}
                      </td>
                    </tr>

                  </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
          </>
        )}

        {/* TIMEBAND ANALYSIS TAB */}
        {visibleTab === 'timeband' && (
          <>
            <SampleDataBanner />
            {/* HEATMAP METRIC SELECTOR */}
            <div className="panel" style={{ marginBottom: '16px' }}>
              <div className="p-4" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <span style={{
                  fontFamily: 'DM Mono, monospace',
                  fontSize: '11px',
                  color: 'var(--text-tertiary)',
                  textTransform: 'uppercase',
                  fontWeight: 600
                }}>
                  Heatmap Metric:
                </span>
                <select
                  value={heatmapMetric}
                  onChange={e => setHeatmapMetric(e.target.value as 'reach' | 'gap' | 'atcIndex')}
                  style={{ fontSize: '12px', padding: '6px 12px' }}
                >
                  <option value="reach">Reach %</option>
                  <option value="gap">Competitive Gap</option>
                  {market === 'Karnataka' && <option value="atcIndex">ATC Index</option>}
                </select>
              </div>
            </div>

            {/* TIMEBAND HEATMAP */}
            <div className="panel" style={{ marginBottom: '32px' }}>
              <div className="panel-header">
                <span style={{
                  fontFamily: 'Outfit, sans-serif',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--text-primary)'
                }}>
                  🔥 4-BAND HEATMAP - {heatmapMetric === 'reach' ? 'Reach %' : heatmapMetric === 'gap' ? 'Gap' : 'ATC Index'}
                </span>
              </div>
              <div className="p-4">
                <TimebandHeatmap
                  channels={displayChannels}
                  metric={heatmapMetric}
                  maxChannels={20}
                />
              </div>
            </div>

            {/* TIMEBAND FILTERS */}
            <div className="panel mb-6">
              <div className="p-5">
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                  <select value={genre} onChange={e => setGenre(e.target.value)} style={{ minWidth: '150px' }}>
                    {genres.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                  <input
                    type="search"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="SEARCH CHANNELS..."
                    style={{ flex: 1, minWidth: '200px' }}
                  />
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer'
                  }}>
                    <input
                      type="checkbox"
                      checked={showAll}
                      onChange={e => setShowAll(e.target.checked)}
                    />
                    <span style={{
                      fontFamily: 'DM Mono, monospace',
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em'
                    }}>
                      {showAll
                        ? `SHOWING ALL CHANNELS (${displayChannels.length})`
                        : `ACTIONABLE CHANNELS (${displayChannels.length})`
                      }
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* CHANNEL LIST WITH TIMEBAND DETAILS */}
            <div className="panel">
              <div className="panel-header">
                <span style={{
                  fontFamily: 'Outfit, sans-serif',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--text-primary)'
                }}>
                  📊 CHANNELS WITH 4-BAND BREAKDOWN
                  {selectedTimeband !== 'all' && ` - Filtered by ${selectedTimeband}`}
                </span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>CHANNEL</th>
                      <th>GENRE</th>
                      <th>SANTOOR REACH</th>
                      <th>GAP</th>
                      <th>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayChannels.map((ch, i) => {
                      const isExpanded = expandedChannel === ch.channel;
                      return (
                        <Fragment key={i}>
                          <tr
                            onClick={() => setExpandedChannel(isExpanded ? null : ch.channel)}
                            style={{
                              cursor: ch.timebands ? 'pointer' : 'default',
                              background: isExpanded ? 'var(--surface-2)' : 'transparent'
                            }}
                          >
                            <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {ch.timebands && (
                                  <span style={{
                                    fontSize: '12px',
                                    color: 'var(--text-tertiary)',
                                    transition: 'transform 0.2s ease',
                                    transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
                                  }}>
                                    ▶
                                  </span>
                                )}
                                {ch.channel}
                              </div>
                            </td>
                            <td style={{ color: 'var(--text-tertiary)' }}>{ch.genre}</td>
                            <td style={{ fontWeight: 600, color: 'var(--orange-bright)', textAlign: 'right' }}>
                              {ch.santoorReach.toFixed(1)}%
                            </td>
                            <td style={{
                              fontWeight: 600,
                              color: ch.gap >= 0 ? 'var(--signal-positive)' : 'var(--signal-negative)',
                              textAlign: 'right'
                            }}>
                              {ch.gap >= 0 ? '+' : ''}{ch.gap.toFixed(1)}
                            </td>
                            <td>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedChannelForInsights(ch.channel);
                                }}
                                className="btn-tactical"
                                style={{ fontSize: '10px', padding: '4px 12px' }}
                              >
                                View Insights
                              </button>
                            </td>
                          </tr>

                          {/* EXPANDED TIMEBAND DETAIL ROW */}
                          {isExpanded && ch.timebands && (
                            <tr>
                              <td colSpan={5} style={{ padding: 0, background: 'var(--surface-1)' }}>
                                <div style={{
                                  padding: '24px',
                                  borderTop: '2px solid var(--border)',
                                  borderBottom: '2px solid var(--border)'
                                }}>
                                  <h4 style={{
                                    fontFamily: 'Outfit, sans-serif',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    color: 'var(--text-primary)',
                                    marginBottom: '16px'
                                  }}>
                                    📊 4-Band Timeband Breakdown: {ch.channel}
                                  </h4>

                                  <div style={{ overflowX: 'auto' }}>
                                    <table className="data-table" style={{ fontSize: '11px' }}>
                                      <thead>
                                        <tr>
                                          <th style={{ fontSize: '10px' }}>TIMEBAND</th>
                                          <th style={{ fontSize: '10px' }}>SANTOOR</th>
                                          <th style={{ fontSize: '10px' }}>COMPETITOR</th>
                                          <th style={{ fontSize: '10px' }}>GAP</th>
                                          <th style={{ fontSize: '10px' }}>SHARE</th>
                                          <th style={{ fontSize: '10px' }}>STATUS</th>
                                          <th style={{ fontSize: '10px' }}>ACTION</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {ch.timebands.map((tb: TimebandMetrics, tbIdx: number) => (
                                          <tr
                                            key={tbIdx}
                                            style={{
                                              background: tb.isPrimetime ? 'rgba(255, 107, 0, 0.04)' : 'transparent',
                                              borderLeft: tb.isPrimetime ? '3px solid var(--orange-bright)' : '3px solid transparent'
                                            }}
                                          >
                                            <td style={{
                                              fontFamily: 'DM Mono, monospace',
                                              fontWeight: 500,
                                              color: 'var(--text-primary)'
                                            }}>
                                              {TIMEBAND_DISPLAY_V2[tb.timeband as keyof typeof TIMEBAND_DISPLAY_V2] || tb.timeband}
                                            </td>
                                            <td style={{
                                              fontWeight: 600,
                                              color: 'var(--orange-bright)',
                                              textAlign: 'right'
                                            }}>
                                              {tb.santoorReach.toFixed(1)}%
                                            </td>
                                            <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                                              {tb.maxCompReach.toFixed(1)}%
                                            </td>
                                            <td style={{
                                              fontWeight: 600,
                                              color: tb.gap >= 0 ? 'var(--signal-positive)' : 'var(--signal-negative)',
                                              textAlign: 'right'
                                            }}>
                                              {tb.gap >= 0 ? '+' : ''}{tb.gap.toFixed(1)}
                                            </td>
                                            <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                                              {tb.santoorShare.toFixed(1)}%
                                            </td>
                                            <td>
                                              <span className={STATUS_CLASSES[getTimebandStatus(tb)] || 'signal-badge signal-neutral'}>
                                                {getTimebandStatus(tb)}
                                              </span>
                                            </td>
                                            <td>
                                              <span className={REC_CLASSES[getTimebandRecommendation(tb)] || 'signal-badge signal-neutral'}>
                                                {REC_ICONS[getTimebandRecommendation(tb)]} {getTimebandRecommendation(tb)}
                                              </span>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* INSIGHTS MODAL */}
            {selectedChannelForInsights && (() => {
              const channel = displayChannels.find(ch => ch.channel === selectedChannelForInsights);
              if (channel && channel.timebands) {
                const insights = generateSimplifiedInsights(channel);
                return (
                  <div
                    style={{
                      position: 'fixed',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: 'rgba(0, 0, 0, 0.75)',
                      backdropFilter: 'blur(4px)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 1000,
                      padding: '20px'
                    }}
                    onClick={() => setSelectedChannelForInsights(null)}
                  >
                    <div
                      style={{
                        maxWidth: '900px',
                        width: '100%',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                        position: 'relative'
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Close button */}
                      <button
                        onClick={() => setSelectedChannelForInsights(null)}
                        style={{
                          position: 'absolute',
                          top: '16px',
                          right: '16px',
                          background: 'var(--surface-3)',
                          border: '1px solid var(--border)',
                          borderRadius: '6px',
                          padding: '8px 16px',
                          fontFamily: 'DM Mono, monospace',
                          fontSize: '11px',
                          fontWeight: 600,
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          zIndex: 10,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'var(--signal-negative)';
                          e.currentTarget.style.color = 'white';
                          e.currentTarget.style.borderColor = 'var(--signal-negative)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'var(--surface-3)';
                          e.currentTarget.style.color = 'var(--text-secondary)';
                          e.currentTarget.style.borderColor = 'var(--border)';
                        }}
                      >
                        ✕ Close
                      </button>

                      <PlannerInsightsSummary insights={insights} channelName={channel.channel} />
                    </div>
                  </div>
                );
              }
              return null;
            })()}
          </>
        )}

        {/* DISTRICT ANALYSIS TAB */}
        {visibleTab === 'district' && (
          <>
            {/* DISTRICT SELECTOR */}
            <DistrictSelector
              sers={districtData.sers}
              selectedSer={selectedDistrictSer}
              onSerSelect={(ser) => {
                setSelectedDistrictSer(ser);
                setSelectedDistrict(null);
              }}
              districts={allDistricts}
              selectedDistrict={selectedDistrict}
              onDistrictSelect={setSelectedDistrict}
            />

            {/* DISTRICT CONTENT */}
            {districtComputed ? (
              <>
                {/* DISTRICT INFO BANNER */}
                <div className="panel" style={{ marginBottom: '24px' }}>
                  <div className="p-4" style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}>
                    <div>
                      <span style={{
                        fontFamily: 'Outfit, sans-serif',
                        fontSize: '18px',
                        fontWeight: 700,
                        color: 'var(--text-primary)'
                      }}>
                        {districtComputed.district.district}
                      </span>
                      <span style={{
                        fontFamily: 'DM Mono, monospace',
                        fontSize: '11px',
                        color: 'var(--text-tertiary)',
                        marginLeft: '12px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em'
                      }}>
                        {selectedDistrictSer} SER
                      </span>
                    </div>
                  </div>
                </div>

                {/* DISTRICT SUMMARY CARDS */}
                <DistrictSummaryCards
                  summary={districtComputed.summary}
                />

                {/* SUB-TAB TOGGLE: Channels | Timebands (timebands are sample data: debug only) */}
                {debug && (
                <div className="panel" style={{ marginBottom: '24px' }}>
                  <div className="p-3" style={{ display: 'flex', gap: '0' }}>
                    {(['channels', 'timebands'] as const).map(st => (
                      <button
                        key={st}
                        onClick={() => setDistrictSubTab(st)}
                        style={{
                          flex: 1,
                          padding: '10px 16px',
                          background: districtSubTab === st ? 'var(--surface-1)' : 'transparent',
                          border: 'none',
                          borderBottom: districtSubTab === st ? '2px solid var(--orange-bright)' : '2px solid transparent',
                          fontFamily: 'DM Mono, monospace',
                          fontSize: '12px',
                          fontWeight: districtSubTab === st ? 600 : 400,
                          color: districtSubTab === st ? 'var(--orange-bright)' : 'var(--text-tertiary)',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                        }}
                      >
                        {st === 'channels' ? '📊 Channels' : '📺 Timebands'}
                      </button>
                    ))}
                  </div>
                </div>
                )}

                {/* CHANNELS SUB-TAB */}
                {districtSubTab === 'channels' && (
                  <div className="panel">
                    <div className="panel-header">
                      <span style={{
                        fontFamily: 'Outfit, sans-serif',
                        fontSize: '14px',
                        fontWeight: 600,
                        color: 'var(--text-primary)'
                      }}>
                        📊 DISTRICT CHANNEL DATA — {districtComputed.district.district} ({districtComputed.filtered.length} channels)
                      </span>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>CHANNEL</th>
                            <th>GENRE</th>
                            <th>SANTOOR</th>
                            <th>GODREJ</th>
                            <th>LUX</th>
                            <th>GAP</th>
                            <th>STATUS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {districtComputed.filtered
                            .sort((a, b) => b.santoorReach - a.santoorReach)
                            .map((ch, i) => {
                              const st = calculateStatus(ch);
                              return (
                                <tr key={i}>
                                  <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{ch.channel}</td>
                                  <td style={{ color: 'var(--text-tertiary)' }}>{ch.genre}</td>
                                  <td style={{ fontWeight: 600, color: 'var(--orange-bright)', textAlign: 'right' }}>
                                    {ch.santoorReach.toFixed(1)}%
                                  </td>
                                  <td style={{ textAlign: 'right' }}>{(ch.godrejReach ?? 0).toFixed(1)}%</td>
                                  <td style={{ textAlign: 'right' }}>{(ch.luxReach ?? 0).toFixed(1)}%</td>
                                  <td style={{
                                    fontWeight: 600,
                                    color: ch.gap >= 0 ? 'var(--signal-positive)' : 'var(--signal-negative)',
                                    textAlign: 'right'
                                  }}>
                                    {ch.gap >= 0 ? '+' : ''}{ch.gap.toFixed(1)}
                                  </td>
                                  <td>
                                    <span className={STATUS_CLASSES[st] || 'signal-badge signal-neutral'}>
                                      {st}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* TIMEBANDS SUB-TAB */}
                {debug && districtSubTab === 'timebands' && (
                  <>
                    <SampleDataBanner />
                    <div className="panel" style={{ marginBottom: '32px' }}>
                      <div className="panel-header">
                        <span style={{
                          fontFamily: 'Outfit, sans-serif',
                          fontSize: '14px',
                          fontWeight: 600,
                          color: 'var(--text-primary)'
                        }}>
                          🔥 DISTRICT TIMEBAND HEATMAP — {districtComputed.district.district}
                        </span>
                      </div>
                      <div className="p-4">
                        <TimebandHeatmap
                          channels={districtComputed.filtered}
                          metric="reach"
                          maxChannels={20}
                        />
                      </div>
                    </div>

                    {/* Channel timeband detail list */}
                    <div className="panel">
                      <div className="panel-header">
                        <span style={{
                          fontFamily: 'Outfit, sans-serif',
                          fontSize: '14px',
                          fontWeight: 600,
                          color: 'var(--text-primary)'
                        }}>
                          📊 CHANNEL TIMEBAND BREAKDOWN
                        </span>
                      </div>
                      <div style={{ overflowX: 'auto' }}>
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>CHANNEL</th>
                              <th>GENRE</th>
                              <th>SANTOOR REACH</th>
                              <th>GAP</th>
                              <th>ACTIONS</th>
                            </tr>
                          </thead>
                          <tbody>
                            {districtComputed.filtered
                              .sort((a, b) => b.santoorReach - a.santoorReach)
                              .map((ch, i) => {
                                const isExpanded = expandedChannel === ch.channel;
                                return (
                                  <Fragment key={i}>
                                    <tr
                                      onClick={() => setExpandedChannel(isExpanded ? null : ch.channel)}
                                      style={{
                                        cursor: ch.timebands ? 'pointer' : 'default',
                                        background: isExpanded ? 'var(--surface-2)' : 'transparent'
                                      }}
                                    >
                                      <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                          {ch.timebands && (
                                            <span style={{
                                              fontSize: '12px',
                                              color: 'var(--text-tertiary)',
                                              transition: 'transform 0.2s ease',
                                              transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
                                            }}>
                                              ▶
                                            </span>
                                          )}
                                          {ch.channel}
                                        </div>
                                      </td>
                                      <td style={{ color: 'var(--text-tertiary)' }}>{ch.genre}</td>
                                      <td style={{ fontWeight: 600, color: 'var(--orange-bright)', textAlign: 'right' }}>
                                        {ch.santoorReach.toFixed(1)}%
                                      </td>
                                      <td style={{
                                        fontWeight: 600,
                                        color: ch.gap >= 0 ? 'var(--signal-positive)' : 'var(--signal-negative)',
                                        textAlign: 'right'
                                      }}>
                                        {ch.gap >= 0 ? '+' : ''}{ch.gap.toFixed(1)}
                                      </td>
                                      <td>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedChannelForInsights(ch.channel);
                                          }}
                                          className="btn-tactical"
                                          style={{ fontSize: '10px', padding: '4px 12px' }}
                                        >
                                          View Insights
                                        </button>
                                      </td>
                                    </tr>

                                    {isExpanded && ch.timebands && (
                                      <tr>
                                        <td colSpan={5} style={{ padding: 0, background: 'var(--surface-1)' }}>
                                          <div style={{
                                            padding: '24px',
                                            borderTop: '2px solid var(--border)',
                                            borderBottom: '2px solid var(--border)'
                                          }}>
                                            <h4 style={{
                                              fontFamily: 'Outfit, sans-serif',
                                              fontSize: '14px',
                                              fontWeight: 600,
                                              color: 'var(--text-primary)',
                                              marginBottom: '16px'
                                            }}>
                                              📊 District Timeband: {ch.channel}
                                            </h4>
                                            <div style={{ overflowX: 'auto' }}>
                                              <table className="data-table" style={{ fontSize: '11px' }}>
                                                <thead>
                                                  <tr>
                                                    <th style={{ fontSize: '10px' }}>TIMEBAND</th>
                                                    <th style={{ fontSize: '10px' }}>SANTOOR</th>
                                                    <th style={{ fontSize: '10px' }}>COMPETITOR</th>
                                                    <th style={{ fontSize: '10px' }}>GAP</th>
                                                    <th style={{ fontSize: '10px' }}>SHARE</th>
                                                    <th style={{ fontSize: '10px' }}>STATUS</th>
                                                    <th style={{ fontSize: '10px' }}>ACTION</th>
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  {ch.timebands.map((tb: TimebandMetrics, tbIdx: number) => (
                                                    <tr
                                                      key={tbIdx}
                                                      style={{
                                                        background: tb.isPrimetime ? 'rgba(255, 107, 0, 0.04)' : 'transparent',
                                                        borderLeft: tb.isPrimetime ? '3px solid var(--orange-bright)' : '3px solid transparent'
                                                      }}
                                                    >
                                                      <td style={{
                                                        fontFamily: 'DM Mono, monospace',
                                                        fontWeight: 500,
                                                        color: 'var(--text-primary)'
                                                      }}>
                                                        {TIMEBAND_DISPLAY_V2[tb.timeband as keyof typeof TIMEBAND_DISPLAY_V2] || tb.timeband}
                                                      </td>
                                                      <td style={{ fontWeight: 600, color: 'var(--orange-bright)', textAlign: 'right' }}>
                                                        {tb.santoorReach.toFixed(1)}%
                                                      </td>
                                                      <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                                                        {tb.maxCompReach.toFixed(1)}%
                                                      </td>
                                                      <td style={{
                                                        fontWeight: 600,
                                                        color: tb.gap >= 0 ? 'var(--signal-positive)' : 'var(--signal-negative)',
                                                        textAlign: 'right'
                                                      }}>
                                                        {tb.gap >= 0 ? '+' : ''}{tb.gap.toFixed(1)}
                                                      </td>
                                                      <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                                                        {tb.santoorShare.toFixed(1)}%
                                                      </td>
                                                      <td>
                                                        <span className={STATUS_CLASSES[getTimebandStatus(tb)] || 'signal-badge signal-neutral'}>
                                                          {getTimebandStatus(tb)}
                                                        </span>
                                                      </td>
                                                      <td>
                                                        <span className={REC_CLASSES[getTimebandRecommendation(tb)] || 'signal-badge signal-neutral'}>
                                                          {REC_ICONS[getTimebandRecommendation(tb)]} {getTimebandRecommendation(tb)}
                                                        </span>
                                                      </td>
                                                    </tr>
                                                  ))}
                                                </tbody>
                                              </table>
                                            </div>
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </Fragment>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </>
            ) : (
              /* Empty state when no district is selected */
              <div className="panel">
                <div className="p-8" style={{
                  textAlign: 'center',
                  color: 'var(--text-tertiary)',
                  fontFamily: 'DM Mono, monospace',
                  fontSize: '13px'
                }}>
                  {!selectedDistrictSer
                    ? 'Select a SER region above to begin district analysis'
                    : 'Select a district to view channel and timeband data'}
                </div>
              </div>
            )}
          </>
        )}

        {/* FOOTER */}
        <div style={{
          textAlign: 'center',
          marginTop: '40px',
          paddingTop: '24px',
          borderTop: '1px solid var(--border-subtle)',
          fontFamily: 'DM Mono, monospace',
          fontSize: '11px',
          color: 'var(--text-dim)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase'
        }}>
          WIPRO SANTOOR © 2026 // DATA COMMAND CENTER
        </div>

      </div>
    </div>
  );
}
