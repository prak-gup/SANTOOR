import React from 'react';
import type { DistrictSummary } from '../utils/districtCalculations';

interface DistrictSummaryCardsProps {
  summary: DistrictSummary;
}

const DistrictSummaryCards: React.FC<DistrictSummaryCardsProps> = ({ summary }) => {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: '16px',
      marginBottom: '32px'
    }}>
      {/* Overall Reach */}
      <div className="metric-card" style={{ textAlign: 'center' }}>
        <div className="metric-label">OVERALL REACH</div>
        <div className="metric-value" style={{ color: 'var(--text-primary)' }}>
          {(summary.reachOverall * 100).toFixed(1)}%
        </div>
      </div>

      {/* Santoor Channels */}
      <div className="metric-card" style={{ textAlign: 'center' }}>
        <div className="metric-label">SANTOOR ACTIVE</div>
        <div className="metric-value" style={{ color: 'var(--orange-bright)' }}>
          {summary.santoorChannels}
        </div>
      </div>

      {/* Avg Gap */}
      <div className="metric-card" style={{ textAlign: 'center' }}>
        <div className="metric-label">AVG GAP</div>
        <div className="metric-value" style={{
          color: summary.avgGap >= 0 ? 'var(--signal-positive)' : 'var(--signal-negative)'
        }}>
          {summary.avgGap >= 0 ? '+' : ''}{summary.avgGap.toFixed(1)}
        </div>
      </div>
    </div>
  );
};

export default DistrictSummaryCards;
