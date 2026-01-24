import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import type { ChannelRecord } from '../../types';
import { TIMEBAND_DISPLAY_V2 } from '../../utils/timebandProcessor';

interface TimebandPerformanceChartProps {
  channel: ChannelRecord;
  competitors: string[];  // ['godrej', 'lux'] or ['lifebuoy', 'mysore_sandal']
  market: string;
}

const COMPETITOR_COLORS: Record<string, string> = {
  'godrej': '#3b82f6',
  'lux': '#8b5cf6',
  'lifebuoy': '#3b82f6',
  'mysore_sandal': '#ec4899'
};

export const TimebandPerformanceChart: React.FC<TimebandPerformanceChartProps> = ({
  channel,
  competitors,
  market
}) => {
  if (!channel.timebands || channel.timebands.length === 0) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        color: 'var(--text-tertiary)',
        fontFamily: 'DM Mono, monospace',
        fontSize: '12px'
      }}>
        No timeband data available for {channel.channel}
      </div>
    );
  }

  const chartData = channel.timebands.map(tb => {
    const data: any = {
      timeband: TIMEBAND_DISPLAY_V2[tb.timeband as keyof typeof TIMEBAND_DISPLAY_V2] || tb.timeband,
      Santoor: tb.santoorReach
    };

    // Add competitor data based on market
    if (market === 'Karnataka') {
      data['Lifebuoy'] = tb.lifebuoyReach || 0;
      data['Mysore Sandal'] = tb.mysore_sandalReach || 0;
    } else {
      data['Godrej'] = tb.godrejReach || 0;
      data['Lux'] = tb.luxReach || 0;
    }

    return data;
  });

  return (
    <div>
      <div style={{
        marginBottom: '16px',
        fontFamily: 'Outfit, sans-serif',
        fontSize: '14px',
        fontWeight: 600,
        color: 'var(--text-primary)'
      }}>
        Timeband Performance: {channel.channel}
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
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
            formatter={(value: number) => `${value.toFixed(2)}%`}
          />
          <Legend
            wrapperStyle={{
              fontSize: '11px',
              fontFamily: 'DM Mono, monospace'
            }}
          />

          <Bar dataKey="Santoor" fill="#ff5722" radius={[4, 4, 0, 0]} />

          {market === 'Karnataka' ? (
            <>
              <Bar dataKey="Lifebuoy" fill={COMPETITOR_COLORS['lifebuoy']} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Mysore Sandal" fill={COMPETITOR_COLORS['mysore_sandal']} radius={[4, 4, 0, 0]} />
            </>
          ) : (
            <>
              <Bar dataKey="Godrej" fill={COMPETITOR_COLORS['godrej']} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Lux" fill={COMPETITOR_COLORS['lux']} radius={[4, 4, 0, 0]} />
            </>
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TimebandPerformanceChart;
