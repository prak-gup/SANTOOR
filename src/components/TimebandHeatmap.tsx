import React from 'react';
import type { ChannelRecord } from '../types';
import { TIMEBAND_LABELS, TIMEBAND_DISPLAY_V2 } from '../utils/timebandProcessor';

interface TimebandHeatmapProps {
  channels: ChannelRecord[];
  metric: 'reach' | 'gap' | 'atcIndex';
  maxChannels?: number;
}

function getHeatmapColor(value: number, metric: string): string {
  if (metric === 'reach' || metric === 'atcIndex') {
    // Green scale for positive metrics
    if (value >= 10) return '#10b981'; // Emerald-500
    if (value >= 5) return '#34d399';  // Emerald-400
    if (value >= 2) return '#6ee7b7';  // Emerald-300
    if (value >= 0.5) return '#a7f3d0'; // Emerald-200
    return '#d1fae5';                  // Emerald-100
  } else {
    // Red-Yellow-Green for gap
    if (value >= 5) return '#10b981';   // Leading (green)
    if (value >= 0) return '#fbbf24';   // Close (yellow)
    if (value >= -5) return '#f59e0b';  // Behind (orange)
    return '#ef4444';                   // Critical (red)
  }
}

function getHeatmapOpacity(value: number): number {
  if (value === 0) return 0.2;
  return Math.min(1, 0.3 + (Math.abs(value) / 20) * 0.7);
}

export const TimebandHeatmap: React.FC<TimebandHeatmapProps> = ({
  channels,
  metric,
  maxChannels = 20
}) => {
  // Filter to channels with timeband data and limit to top N
  const channelsWithTimebands = channels
    .filter(ch => ch.timebands && ch.timebands.length > 0)
    .slice(0, maxChannels);

  if (channelsWithTimebands.length === 0) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        color: 'var(--text-tertiary)',
        fontFamily: 'DM Mono, monospace',
        fontSize: '12px'
      }}>
        No timeband data available for selected channels
      </div>
    );
  }

  const metricLabel = metric === 'reach' ? 'Reach Index'
    : metric === 'gap' ? 'Gap'
    : 'ATC Index';

  // Calculate indexes for reach and ATC (show indexes instead of raw %)
  // For each channel, highest timeband = 100, others relative to it
  const channelIndexes = new Map<string, Record<string, number>>();

  if (metric === 'reach' || metric === 'atcIndex') {
    channelsWithTimebands.forEach(channel => {
      if (!channel.timebands) return;

      // Find max value for this channel across all timebands
      const values = channel.timebands.map(tb =>
        metric === 'reach' ? tb.santoorReach : (tb.atcIndex ?? 0)
      );
      const maxValue = Math.max(...values, 0.01); // Avoid division by zero

      // Calculate index for each timeband (max = 100)
      const indexes: Record<string, number> = {};
      channel.timebands.forEach(tb => {
        const rawValue = metric === 'reach' ? tb.santoorReach : (tb.atcIndex ?? 0);
        indexes[tb.timeband] = (rawValue / maxValue) * 100;
      });

      channelIndexes.set(channel.channel, indexes);
    });
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{
        display: 'inline-block',
        minWidth: '100%',
        fontFamily: 'DM Mono, monospace',
        fontSize: '11px'
      }}>
        {/* Header - 4-BAND SYSTEM */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '200px repeat(4, 120px)',
          gap: '1px',
          marginBottom: '8px'
        }}>
          <div style={{
            padding: '8px',
            fontFamily: 'Outfit, sans-serif',
            fontSize: '10px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--text-tertiary)'
          }}>
            Channel / {metricLabel}
          </div>
          {TIMEBAND_LABELS.map(tb => (
            <div
              key={tb}
              style={{
                padding: '8px 4px',
                textAlign: 'center',
                fontWeight: 500,
                color: 'var(--text-secondary)',
                fontSize: '10px'
              }}
            >
              {TIMEBAND_DISPLAY_V2[tb as keyof typeof TIMEBAND_DISPLAY_V2]}
            </div>
          ))}
        </div>

        {/* Heatmap rows - 4-BAND SYSTEM */}
        {channelsWithTimebands.map(channel => (
          <div
            key={channel.channel}
            style={{
              display: 'grid',
              gridTemplateColumns: '200px repeat(4, 120px)',
              gap: '1px',
              marginBottom: '1px'
            }}
          >
            {/* Channel name */}
            <div style={{
              padding: '12px 8px',
              background: 'var(--surface-2)',
              fontWeight: 500,
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: '11px'
            }}>
              {channel.channel}
            </div>

            {/* Timeband cells - 4 bands */}
            {TIMEBAND_LABELS.map(tb => {
              const timebandData = channel.timebands?.find(t => t.timeband === tb);
              let rawValue = 0;
              let displayValue = 0;

              if (timebandData) {
                if (metric === 'reach') rawValue = timebandData.santoorReach;
                else if (metric === 'gap') rawValue = timebandData.gap;
                else if (metric === 'atcIndex') rawValue = timebandData.atcIndex ?? 0;
              }

              // For reach and ATC, show index (max timeband = 100)
              // For gap, show raw number
              if (metric === 'reach' || metric === 'atcIndex') {
                const indexes = channelIndexes.get(channel.channel);
                displayValue = indexes ? (indexes[tb] ?? 0) : 0;
              } else {
                displayValue = rawValue;
              }

              // Use raw value for color calculation
              const bgColor = getHeatmapColor(rawValue, metric);
              const opacity = getHeatmapOpacity(rawValue);

              // Tooltip shows both index and raw value for reach/ATC
              const tooltipText = metric === 'reach'
                ? `${channel.channel} ${tb}: ${displayValue.toFixed(0)} (${rawValue.toFixed(2)}% reach)`
                : metric === 'atcIndex'
                ? `${channel.channel} ${tb}: ${displayValue.toFixed(0)} (ATC: ${rawValue.toFixed(0)})`
                : `${channel.channel} ${tb}: ${displayValue.toFixed(1)}`;

              return (
                <div
                  key={tb}
                  style={{
                    padding: '12px 4px',
                    textAlign: 'center',
                    background: bgColor,
                    opacity: opacity,
                    fontWeight: 600,
                    color: Math.abs(rawValue) > 5 ? 'white' : 'var(--text-primary)',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer',
                    fontSize: '11px'
                  }}
                  title={tooltipText}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.05)';
                    e.currentTarget.style.zIndex = '10';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.zIndex = '1';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  {displayValue !== 0 ? (
                    <>
                      {metric === 'gap' && displayValue > 0 && '+'}
                      {metric === 'reach' || metric === 'atcIndex'
                        ? Math.round(displayValue)  // Show index as whole number
                        : displayValue.toFixed(1)   // Show gap with 1 decimal
                      }
                    </>
                  ) : (
                    <span style={{ color: 'var(--text-dim)' }}>-</span>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {/* Legend */}
        <div style={{
          marginTop: '24px',
          padding: '12px',
          background: 'var(--surface-2)',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '24px',
          flexWrap: 'wrap'
        }}>
          <div style={{
            fontSize: '10px',
            fontWeight: 600,
            textTransform: 'uppercase',
            color: 'var(--text-tertiary)',
            letterSpacing: '0.05em'
          }}>
            LEGEND:
          </div>

          {metric === 'reach' || metric === 'atcIndex' ? (
            <>
              <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                Index: Best timeband = 100, others relative
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '20px', height: '12px', background: '#10b981', borderRadius: '2px' }} />
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Strong (90-100)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '20px', height: '12px', background: '#34d399', borderRadius: '2px' }} />
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Good (60-90)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '20px', height: '12px', background: '#6ee7b7', borderRadius: '2px' }} />
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Moderate (30-60)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '20px', height: '12px', background: '#a7f3d0', borderRadius: '2px' }} />
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Weak (&lt;30)</span>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '20px', height: '12px', background: '#10b981', borderRadius: '2px' }} />
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Leading (+5 or more)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '20px', height: '12px', background: '#fbbf24', borderRadius: '2px' }} />
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Close (0 to +5)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '20px', height: '12px', background: '#f59e0b', borderRadius: '2px' }} />
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Behind (-5 to 0)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '20px', height: '12px', background: '#ef4444', borderRadius: '2px' }} />
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Critical (&lt;-5)</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TimebandHeatmap;
