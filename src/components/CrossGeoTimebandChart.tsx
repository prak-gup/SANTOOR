import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import type { CrossGeoTimebandComparison } from '../types';

interface CrossGeoTimebandChartProps {
  channelName: string;
  comparisons: CrossGeoTimebandComparison[];
}

const TIMEBAND_SHORT = {
  '02:00-05:00': '02-05',
  '05:00-08:00': '05-08',
  '08:00-11:00': '08-11',
  '11:00-14:00': '11-14',
  '14:00-17:00': '14-17',
  '17:00-20:00': '17-20',
  '20:00-23:00': '20-23',
  '23:00-26:00': '23-02'
};

const MARKET_COLORS = {
  UP: '#3b82f6',
  Maharashtra: '#8b5cf6',
  Karnataka: '#10b981'
};

export const CrossGeoTimebandChart: React.FC<CrossGeoTimebandChartProps> = ({
  channelName,
  comparisons
}) => {
  if (comparisons.length === 0) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        color: 'var(--text-tertiary)',
        fontFamily: 'DM Mono, monospace',
        fontSize: '12px'
      }}>
        No cross-geography data available for {channelName}
      </div>
    );
  }

  const chartData = comparisons.map(comp => ({
    timeband: TIMEBAND_SHORT[comp.timeband as keyof typeof TIMEBAND_SHORT] || comp.timeband,
    UP: comp.markets.UP,
    Maharashtra: comp.markets.Maharashtra,
    Karnataka: comp.markets.Karnataka
  }));

  return (
    <div>
      <div style={{
        marginBottom: '16px',
        fontFamily: 'Outfit, sans-serif',
        fontSize: '14px',
        fontWeight: 600,
        color: 'var(--text-primary)'
      }}>
        Cross-Market Timeband Performance: {channelName}
      </div>

      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="timeband"
            angle={-45}
            textAnchor="end"
            height={80}
            tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
          />
          <YAxis
            label={{
              value: 'Reach %',
              angle: -90,
              position: 'insideLeft',
              style: { fill: 'var(--text-secondary)', fontSize: 11 }
            }}
            tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--surface-1)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              fontSize: '11px',
              fontFamily: 'DM Mono, monospace'
            }}
            formatter={(value: number | undefined) => value !== undefined ? `${value.toFixed(2)}%` : ''}
          />
          <Legend
            wrapperStyle={{
              fontSize: '11px',
              fontFamily: 'DM Mono, monospace'
            }}
            formatter={(value: string) => {
              if (value === 'Maharashtra') return 'Rest of Maharashtra';
              return value;
            }}
          />

          <Line
            type="monotone"
            dataKey="UP"
            stroke={MARKET_COLORS.UP}
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="Maharashtra"
            stroke={MARKET_COLORS.Maharashtra}
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="Karnataka"
            stroke={MARKET_COLORS.Karnataka}
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Variance indicators */}
      <div style={{
        marginTop: '16px',
        display: 'flex',
        gap: '16px',
        flexWrap: 'wrap',
        fontSize: '10px',
        color: 'var(--text-tertiary)',
        fontFamily: 'DM Mono, monospace'
      }}>
        {comparisons
          .filter(c => c.variance > 2.0) // Only show high variance timebands
          .map(c => (
            <div
              key={c.timeband}
              style={{
                padding: '4px 8px',
                background: 'var(--surface-2)',
                borderRadius: '4px',
                border: '1px solid var(--border)'
              }}
            >
              {TIMEBAND_SHORT[c.timeband as keyof typeof TIMEBAND_SHORT]}: High variance ({c.variance.toFixed(1)})
            </div>
          ))}
      </div>
    </div>
  );
};

export default CrossGeoTimebandChart;
