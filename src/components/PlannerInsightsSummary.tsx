import React from 'react';
import type { SimplifiedPlannerInsights } from '../types';
import { TIMEBAND_DISPLAY_V2 } from '../utils/timebandProcessor';

interface PlannerInsightsSummaryProps {
  insights: SimplifiedPlannerInsights;
  channelName: string;
}

const PlannerInsightsSummary: React.FC<PlannerInsightsSummaryProps> = ({
  insights,
  channelName
}) => {
  return (
    <div className="panel" style={{ marginBottom: '32px' }}>
      <div className="panel-header">
        <span style={{
          fontFamily: 'Outfit, sans-serif',
          fontSize: '16px',
          fontWeight: 600,
          color: 'var(--text-primary)'
        }}>
          💡 STRATEGIC INSIGHTS: {channelName}
        </span>
      </div>

      <div className="p-6">
        {/* 2 KEY METRICS ROW */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '16px',
          marginBottom: '24px'
        }}>
          <MetricCard
            label="Prime Focus"
            value={`${insights.primeTimeFocus.toFixed(0)}%`}
            color={insights.primeTimeFocus > 70 ? 'var(--orange-bright)' : 'var(--text-secondary)'}
            subtitle={insights.primeTimeFocus > 70 ? 'Prime-dependent' : 'Balanced'}
          />

          <MetricCard
            label="Top Action"
            value={insights.topAction ? insights.topAction.action : 'NONE'}
            color={
              insights.topActionPriority === 'HIGH' ? 'var(--signal-negative)' :
              insights.topActionPriority === 'MEDIUM' ? 'var(--signal-warning)' :
              'var(--signal-positive)'
            }
            subtitle={insights.topAction ? TIMEBAND_DISPLAY_V2[insights.topAction.timeband as keyof typeof TIMEBAND_DISPLAY_V2] || insights.topAction.timeband : 'All good'}
          />
        </div>

        {/* ACTION CARD */}
        {insights.topAction && (
          <div style={{
            background: 'var(--surface-2)',
            border: '2px solid var(--border)',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '24px',
            borderLeft: `6px solid ${
              insights.topActionPriority === 'HIGH' ? 'var(--signal-negative)' :
              insights.topActionPriority === 'MEDIUM' ? 'var(--signal-warning)' :
              'var(--signal-positive)'
            }`
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{
                  fontSize: '28px'
                }}>
                  🎯
                </span>
                <div>
                  <div style={{
                    fontFamily: 'Outfit, sans-serif',
                    fontSize: '15px',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    marginBottom: '4px'
                  }}>
                    {insights.topAction.action} in {TIMEBAND_DISPLAY_V2[insights.topAction.timeband as keyof typeof TIMEBAND_DISPLAY_V2] || insights.topAction.timeband}
                  </div>
                  <div style={{
                    fontSize: '11px',
                    color: 'var(--text-tertiary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    {insights.topActionPriority} Priority Action
                  </div>
                </div>
              </div>

              <div style={{
                background: 'rgba(255, 107, 0, 0.1)',
                padding: '8px 16px',
                borderRadius: '8px',
                textAlign: 'center'
              }}>
                <div style={{
                  fontSize: '9px',
                  color: 'var(--text-dim)',
                  textTransform: 'uppercase',
                  marginBottom: '2px'
                }}>
                  Expected Uplift
                </div>
                <div style={{
                  fontFamily: 'Outfit, sans-serif',
                  fontSize: '18px',
                  fontWeight: 700,
                  color: 'var(--orange-bright)'
                }}>
                  +{insights.topAction.estimatedUplift.toFixed(1)}%
                </div>
              </div>
            </div>

            <div style={{
              fontFamily: 'DM Mono, monospace',
              fontSize: '12px',
              lineHeight: '1.7',
              color: 'var(--text-secondary)',
              background: 'var(--surface-1)',
              padding: '12px 16px',
              borderRadius: '8px'
            }}>
              {insights.topAction.reason}
            </div>
          </div>
        )}

        {/* RECOMMENDATION TEXT */}
        <div style={{
          background: 'rgba(139, 92, 246, 0.08)',
          border: '2px solid var(--signal-purple)',
          borderRadius: '12px',
          padding: '20px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px'
          }}>
            <span style={{ fontSize: '24px', marginTop: '2px' }}>💡</span>
            <div>
              <div style={{
                fontFamily: 'Outfit, sans-serif',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--signal-purple)',
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.08em'
              }}>
                Strategic Recommendation
              </div>
              <div style={{
                fontFamily: 'DM Mono, monospace',
                fontSize: '12px',
                lineHeight: '1.8',
                color: 'var(--text-primary)'
              }}>
                {insights.recommendation}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// SUB-COMPONENTS
// ============================================================

interface MetricCardProps {
  label: string;
  value: string;
  color: string;
  subtitle?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, color, subtitle }) => (
  <div style={{
    background: 'var(--surface-2)',
    border: '2px solid var(--border)',
    borderRadius: '12px',
    padding: '20px',
    textAlign: 'center'
  }}>
    <div style={{
      fontSize: '10px',
      textTransform: 'uppercase',
      color: 'var(--text-dim)',
      marginBottom: '10px',
      letterSpacing: '0.08em',
      fontWeight: 600
    }}>
      {label}
    </div>
    <div style={{
      fontFamily: 'Outfit, sans-serif',
      fontSize: '28px',
      fontWeight: 700,
      color: color,
      marginBottom: '6px'
    }}>
      {value}
    </div>
    {subtitle && (
      <div style={{
        fontSize: '11px',
        color: 'var(--text-tertiary)',
        fontWeight: 500
      }}>
        {subtitle}
      </div>
    )}
  </div>
);

export default PlannerInsightsSummary;
