import { useState, useMemo, useEffect, useRef } from 'react';
import '@fontsource/dm-mono/400.css';
import '@fontsource/dm-mono/500.css';
import '@fontsource/outfit/400.css';
import '@fontsource/outfit/600.css';
import '@fontsource/outfit/700.css';
import data from './data/santoor_multimarket_data.json';
import {
  filterRelevantChannels,
  calculateStatus,
  runOptimization,
} from './utils/optimization';
import type { ChannelRecord } from './utils/optimization';

type MarketName = string;

interface MarketData {
  scrs: string[];
  competitors: string[];
  optimizationType: string;
  marketShare: Record<string, number>;
  summaries: Record<string, any>;
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

export default function App() {
  const [market, setMarket] = useState<MarketName>('Maharashtra');
  const [scr, setSCR] = useState<string>('Maharashtra Overall');
  const [intensity, setIntensity] = useState<number>(15);
  const [threshold, setThreshold] = useState<number>(70);
  const [isOptimized, setIsOptimized] = useState<boolean>(false);
  const [results, setResults] = useState<Map<string, any>>(new Map());
  const [showAll, setShowAll] = useState<boolean>(false);
  const [genre, setGenre] = useState<string>('All');
  const [search, setSearch] = useState<string>('');
  const [sortCol, setSortCol] = useState<string>('santoorReach');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const prevOptimizedRef = useRef(false);

  const marketData = santoorData.markets[market];
  const scrs = marketData?.scrs || [];
  const competitors = marketData?.competitors || [];
  const optType = marketData?.optimizationType || 'Reach';
  const rawChannels: ChannelRecord[] = marketData?.channelData[scr] || [];

  useEffect(() => { setIsOptimized(false); setResults(new Map()); }, [market, scr]);
  useEffect(() => {
    const def = `${market} Overall`;
    if (scrs.includes(def)) setSCR(def);
    else if (scrs.length > 0) setSCR(scrs[0]);
  }, [market, scrs]);

  const genres = useMemo(() => ['All', ...new Set(rawChannels.map(c => c.genre))], [rawChannels]);

  const displayChannels = useMemo(() => {
    let filtered = showAll ? rawChannels : filterRelevantChannels(rawChannels);
    if (genre !== 'All') filtered = filtered.filter(c => c.genre === genre);
    if (search) filtered = filtered.filter(c => c.channel.toLowerCase().includes(search.toLowerCase()));
    return [...filtered].sort((a, b) => {
      const aV = (a as any)[sortCol] ?? 0, bV = (b as any)[sortCol] ?? 0;
      return sortDir === 'asc' ? (aV > bV ? 1 : -1) : (aV < bV ? 1 : -1);
    });
  }, [rawChannels, showAll, genre, search, sortCol, sortDir]);

  useEffect(() => {
    if (prevOptimizedRef.current && displayChannels.length > 0) {
      const optimizationResults = runOptimization(displayChannels, intensity, threshold);
      setResults(optimizationResults);
    }
  }, [intensity, threshold, displayChannels]);

  useEffect(() => {
    prevOptimizedRef.current = isOptimized;
  }, [isOptimized]);

  const summary = useMemo(() => {
    const rel = filterRelevantChannels(rawChannels);
    const withS = rel.filter(c => c.santoorReach > 0);
    const opp = rel.filter(c => c.santoorReach === 0 && c.maxCompReach >= 2.0 && c.channelShare >= 1.0);
    const avgGap = withS.length ? withS.reduce((s, c) => s + c.gap, 0) / withS.length : 0;
    const avgATC = market === 'Karnataka' && withS.length ? withS.reduce((s, c) => s + ((c as any).atcIndex || 0), 0) / withS.length : null;
    return {
      total: rawChannels.length,
      rel: rel.length,
      active: withS.length,
      opp: opp.length,
      avgGap,
      avgATC,
      status: avgGap >= 2 ? 'LEADING' : avgGap >= 0 ? 'CLOSE' : avgGap >= -2 ? 'BEHIND' : 'CRITICAL'
    };
  }, [rawChannels, market]);

  const optSum = useMemo(() => {
    const arr = [...results.values()];
    return {
      inc: arr.filter(r => r.recommendation === 'INCREASE').length,
      mnt: arr.filter(r => r.recommendation === 'MAINTAIN').length,
      add: arr.filter(r => r.recommendation === 'ADD').length,
      dec: arr.filter(r => r.recommendation === 'DECREASE').length,
      hi: arr.filter(r => r.priority === 'HIGH').length
    };
  }, [results]);

  const handleOpt = () => {
    const optimizationResults = runOptimization(displayChannels, intensity, threshold);
    setResults(optimizationResults);
    setIsOptimized(true);
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
          <div className="p-8 relative">
            <div className="absolute top-0 left-0 w-1 h-full" style={{
              background: 'linear-gradient(180deg, var(--orange-bright), var(--orange-dim))',
              boxShadow: 'var(--glow-orange)'
            }}></div>
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
                  onChange={e => setMarket(e.target.value as MarketName)}
                  style={{ minWidth: '180px' }}
                >
                  {santoorData.metadata.markets.map(m => <option key={m} value={m}>{m}</option>)}
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

        {/* OPTIMIZATION CONTROLS */}
        <div style={{ marginBottom: '32px' }}>
          {/* Optimization Panel */}
          <div className="panel">
            <div className="panel-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{
                  fontFamily: 'Outfit, sans-serif',
                  fontSize: '16px',
                  fontWeight: 600,
                  color: 'var(--text-primary)'
                }}>
                  ⚙️ OPTIMIZATION ENGINE
                </span>
                <span className={`signal-badge ${optType === 'ATC' ? 'signal-purple' : 'signal-info'}`}>
                  {optType === 'ATC' ? 'ATC MODE' : 'REACH MODE'}
                </span>
              </div>
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
                    display: 'block',
                    marginBottom: '8px'
                  }}>
                    INTENSITY: <span style={{ color: 'var(--orange-bright)', fontSize: '14px' }}>{intensity}%</span>
                  </label>
                  <input
                    type="range"
                    min="5"
                    max="30"
                    value={intensity}
                    onChange={e => setIntensity(+e.target.value)}
                    style={{ width: '100%' }}
                  />
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: '8px',
                    fontSize: '10px',
                    color: 'var(--text-dim)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em'
                  }}>
                    <span>Conservative</span>
                    <span>Aggressive</span>
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
                    display: 'block',
                    marginBottom: '8px'
                  }}>
                    THRESHOLD: <span style={{ color: 'var(--orange-bright)', fontSize: '14px' }}>{threshold}%</span>
                  </label>
                  <input
                    type="range"
                    min="50"
                    max="90"
                    step="5"
                    value={threshold}
                    onChange={e => setThreshold(+e.target.value)}
                    style={{ width: '100%' }}
                  />
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: '8px',
                    fontSize: '10px',
                    color: 'var(--text-dim)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em'
                  }}>
                    <span>More Changes</span>
                    <span>Fewer</span>
                  </div>
                </div>
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <button onClick={handleOpt} className="btn-tactical btn-primary" style={{ width: '100%', padding: '16px' }}>
                  🚀 RUN OPTIMIZATION
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* METRIC CARDS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '48px' }}>
          {/* Metric Cards */}
          <div className="metric-card" style={{ textAlign: 'center' }}>
            <div className="metric-label">CHANNELS</div>
            <div className="metric-value" style={{ color: 'var(--text-primary)' }}>{summary.rel}</div>
          </div>

          <div className="metric-card" style={{ textAlign: 'center' }}>
            <div className="metric-label">SANTOOR ACTIVE</div>
            <div className="metric-value" style={{ color: 'var(--orange-bright)' }}>{summary.active}</div>
          </div>

          <div className="metric-card" style={{ textAlign: 'center' }}>
            <div className="metric-label">OPPORTUNITIES</div>
            <div className="metric-value" style={{ color: 'var(--signal-purple)' }}>{summary.opp}</div>
          </div>

          <div className="metric-card" style={{ textAlign: 'center' }}>
            <div className="metric-label">AVG GAP</div>
            <div className="metric-value" style={{
              color: summary.avgGap >= 0 ? 'var(--signal-positive)' : 'var(--signal-negative)'
            }}>
              {summary.avgGap >= 0 ? '+' : ''}{summary.avgGap.toFixed(1)}
            </div>
            <div style={{ marginTop: '12px' }}>
              <span className={STATUS_CLASSES[summary.status] || 'signal-badge signal-neutral'}>
                {summary.status}
              </span>
            </div>
          </div>

          {summary.avgATC !== null && (
            <div className="metric-card" style={{ textAlign: 'center' }}>
              <div className="metric-label">AVG ATC INDEX</div>
              <div className="metric-value" style={{ color: 'var(--signal-purple)' }}>
                {summary.avgATC.toFixed(1)}
              </div>
            </div>
          )}
        </div>

        {/* OPTIMIZATION RESULTS */}
        {isOptimized && (
          <div className="panel mb-6" style={{
            borderColor: 'var(--orange-bright)',
            boxShadow: 'var(--glow-orange)'
          }}>
            <div className="panel-header">
              <span style={{
                fontFamily: 'Outfit, sans-serif',
                fontSize: '16px',
                fontWeight: 600,
                color: 'var(--text-primary)'
              }}>
                📊 OPTIMIZATION RESULTS
              </span>
            </div>
            <div className="p-6">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
                <div style={{ textAlign: 'center', padding: '16px', background: 'var(--surface-2)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--signal-positive)' }}>{optSum.inc}</div>
                  <div className="signal-badge signal-positive" style={{ marginTop: '8px' }}>INCREASE</div>
                </div>
                <div style={{ textAlign: 'center', padding: '16px', background: 'var(--surface-2)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--signal-info)' }}>{optSum.mnt}</div>
                  <div className="signal-badge signal-info" style={{ marginTop: '8px' }}>MAINTAIN</div>
                </div>
                <div style={{ textAlign: 'center', padding: '16px', background: 'var(--surface-2)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--signal-purple)' }}>{optSum.add}</div>
                  <div className="signal-badge signal-purple" style={{ marginTop: '8px' }}>ADD</div>
                </div>
                <div style={{ textAlign: 'center', padding: '16px', background: 'var(--surface-2)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--signal-negative)' }}>{optSum.dec}</div>
                  <div className="signal-badge signal-negative" style={{ marginTop: '8px' }}>DECREASE</div>
                </div>
                <div style={{ textAlign: 'center', padding: '16px', background: 'var(--surface-2)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--orange-bright)' }}>{optSum.hi}</div>
                  <div className="signal-badge" style={{
                    background: 'rgba(255, 107, 0, 0.15)',
                    color: 'var(--orange-bright)',
                    borderColor: 'rgba(255, 107, 0, 0.3)',
                    marginTop: '8px'
                  }}>
                    HIGH PRIORITY
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

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
                cursor: 'pointer',
                fontFamily: 'DM Mono, monospace',
                fontSize: '12px',
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em'
              }}>
                <input
                  type="checkbox"
                  checked={showAll}
                  onChange={e => setShowAll(e.target.checked)}
                />
                SHOW ALL CHANNELS
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
                    ...(market === 'Karnataka' ? [{ key: 'atcIndex', label: 'ATC' }] : []),
                    { key: 'gap', label: 'GAP' },
                    { key: 'indexVsCompetition', label: 'INDEX' },
                    { key: 'status', label: 'STATUS' },
                    ...(isOptimized ? [
                      { key: 'rec', label: 'ACTION' },
                      { key: 'reason', label: 'REASON' }
                    ] : [])
                  ].map(col => (
                    <th
                      key={col.key}
                      onClick={() => !['status', 'rec', 'reason', 'comp1', 'comp2'].includes(col.key) && handleSort(col.key)}
                      className={!['status', 'rec', 'reason', 'comp1', 'comp2'].includes(col.key) ? 'sortable' : ''}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {col.label}
                        {sortCol === col.key && (
                          <span style={{ color: 'var(--orange-bright)', fontSize: '14px' }}>
                            {sortDir === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayChannels.map((ch, i) => {
                  const st = calculateStatus(ch);
                  const opt = results.get(ch.channel);
                  return (
                    <tr key={i}>
                      <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{ch.channel}</td>
                      <td style={{ color: 'var(--text-tertiary)' }}>{ch.genre}</td>
                      <td style={{ fontWeight: 600, color: 'var(--orange-bright)', textAlign: 'right' }}>
                        {ch.santoorReach.toFixed(1)}%
                      </td>
                      <td style={{ textAlign: 'right' }}>{getComp(ch, 0).toFixed(1)}%</td>
                      <td style={{ textAlign: 'right' }}>{getComp(ch, 1).toFixed(1)}%</td>
                      {market === 'Karnataka' && (
                        <td style={{ color: 'var(--signal-purple)', fontWeight: 500, textAlign: 'right' }}>
                          {(ch as any).atcIndex?.toFixed(1) || '-'}
                        </td>
                      )}
                      <td style={{
                        fontWeight: 600,
                        color: ch.gap >= 0 ? 'var(--signal-positive)' : 'var(--signal-negative)',
                        textAlign: 'right'
                      }}>
                        {ch.gap >= 0 ? '+' : ''}{ch.gap.toFixed(1)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {(ch as any).indexVsCompetition?.toFixed(0) || '-'}
                      </td>
                      <td>
                        <span className={STATUS_CLASSES[st] || 'signal-badge signal-neutral'}>
                          {st}
                        </span>
                      </td>
                      {isOptimized && (
                        <>
                          <td>
                            {opt && (
                              <span className={REC_CLASSES[opt.recommendation] || 'signal-badge signal-neutral'}>
                                {REC_ICONS[opt.recommendation]} {opt.recommendation}
                              </span>
                            )}
                          </td>
                          <td style={{
                            color: 'var(--text-tertiary)',
                            fontSize: '12px',
                            maxWidth: '200px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {opt?.reason || '-'}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

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
