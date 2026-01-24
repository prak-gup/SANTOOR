import React from 'react';
import { DAYPART_CATEGORIES_V2, TIMEBAND_DISPLAY_V2 } from '../utils/timebandProcessor';

interface TimebandSelectorProps {
  selectedTimeband: string | 'all';
  onTimebandChange: (timeband: string) => void;
  timebandStats: Record<string, { reach: number; isPrime: boolean }>;
}

export const TimebandSelector: React.FC<TimebandSelectorProps> = ({
  selectedTimeband,
  onTimebandChange,
  timebandStats
}) => {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(5, minmax(100px, 1fr))',
      gap: '12px',
      padding: '16px',
      background: 'var(--surface-1)',
      borderRadius: '8px',
      border: '1px solid var(--border)'
    }}>
      {/* ALL TIMEBANDS button */}
      <button
        onClick={() => onTimebandChange('all')}
        className={`btn-tactical ${selectedTimeband === 'all' ? 'active' : ''}`}
        style={{
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '4px',
          minHeight: '70px'
        }}
      >
        <div style={{
          fontFamily: 'Outfit, sans-serif',
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '0.05em'
        }}>
          ALL
        </div>
        <div style={{
          fontFamily: 'DM Mono, monospace',
          fontSize: '10px',
          color: 'var(--text-tertiary)'
        }}>
          24 Hours
        </div>
      </button>

      {/* Individual timeband buttons - 4-BAND SYSTEM */}
      {Object.entries(TIMEBAND_DISPLAY_V2).map(([key, label]) => {
        const stats = timebandStats[key];
        const isPrime = DAYPART_CATEGORIES_V2[key as keyof typeof DAYPART_CATEGORIES_V2]?.isPrime || false;
        const isSelected = selectedTimeband === key;

        return (
          <button
            key={key}
            onClick={() => onTimebandChange(key)}
            className={`btn-tactical ${isSelected ? 'active' : ''}`}
            style={{
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              minHeight: '70px',
              position: 'relative',
              ...(isPrime && !isSelected ? {
                borderColor: 'rgba(255, 107, 0, 0.3)',
                background: 'rgba(255, 107, 0, 0.03)'
              } : {})
            }}
          >
            {/* Prime indicator */}
            {isPrime && (
              <div style={{
                position: 'absolute',
                top: '4px',
                right: '4px',
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: 'var(--orange-bright)',
                boxShadow: '0 0 8px rgba(255, 107, 0, 0.6)'
              }} />
            )}

            <div style={{
              fontFamily: 'DM Mono, monospace',
              fontSize: '13px',
              fontWeight: 500,
              letterSpacing: '0.02em'
            }}>
              {label}
            </div>

            {stats && (
              <div style={{
                fontFamily: 'Outfit, sans-serif',
                fontSize: '15px',
                fontWeight: 600,
                color: stats.reach > 0 ? 'var(--orange-bright)' : 'var(--text-dim)'
              }}>
                {stats.reach.toFixed(1)}%
              </div>
            )}

            {!stats && (
              <div style={{
                fontFamily: 'DM Mono, monospace',
                fontSize: '10px',
                color: 'var(--text-dim)'
              }}>
                N/A
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default TimebandSelector;
