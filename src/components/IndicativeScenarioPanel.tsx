import type { CSSProperties } from 'react';
import type { BandValues, ScenarioResult } from '../utils/scenario';

interface Props {
  scenario: ScenarioResult;
}

const howStyle: CSSProperties = {
  marginTop: '8px',
  fontSize: '10px',
  lineHeight: 1.45,
  color: 'var(--text-dim)',
  fontFamily: 'DM Mono, monospace',
};

const signed = (n: number, dp = 1) => {
  const r = Number(n.toFixed(dp));
  return `${r > 0 ? '+' : r < 0 ? '−' : ''}${Math.abs(r).toFixed(dp)}`;
};

function Band(props: {
  label: string;
  values: BandValues;
  format: (n: number) => string;
  how: string;
  tone?: 'signed' | 'plain';
}) {
  const { values, format } = props;
  const baseNum = Number(values.base.toFixed(2));
  const color =
    props.tone === 'plain' || baseNum === 0
      ? 'var(--text-primary)'
      : baseNum > 0
        ? 'var(--signal-positive)'
        : 'var(--signal-negative)';
  return (
    <div style={{ padding: '16px', background: 'var(--surface-2)', borderRadius: '8px' }} title={props.how}>
      <div className="metric-label">{props.label}</div>
      <div style={{ fontSize: '26px', fontWeight: 700, color, fontFamily: 'Outfit, sans-serif' }}>{format(values.base)}</div>
      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'DM Mono, monospace' }}>
        range {format(values.low)} to {format(values.high)}
      </div>
      <div style={howStyle}>{props.how}</div>
    </div>
  );
}

export default function IndicativeScenarioPanel({ scenario: s }: Props) {
  const l2 = s.layer2;
  return (
    <div className="panel" style={{ marginBottom: '32px' }}>
      <div className="panel-header">
        <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
          Indicative scenario - modelled, not a forecast
        </span>
      </div>
      <div className="p-6">
        <p style={{ fontSize: '12px', lineHeight: 1.55, color: 'var(--text-secondary)', margin: '0 0 16px 0' }}>
          Touched channels only. Figures are duplicated reach-points summed across channels, <strong>not audience reach</strong>: the same
          viewer can be counted on several channels, and the data has no spend, GRP or overlap. Each figure shows the base case with a
          low-to-high range from curve-shape sensitivity, not a statistical confidence interval.
        </p>

        {!l2 ? (
          <div
            role="status"
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--surface-2)',
              fontSize: '12px',
              color: 'var(--text-secondary)',
            }}
          >
            Projection suppressed. {s.layer2SuppressedReason}
          </div>
        ) : l2.touchedChannels === 0 ? (
          <div
            role="status"
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--surface-2)',
              fontSize: '12px',
              color: 'var(--text-secondary)',
            }}
          >
            No channel is touched at these levers, so the projected change is 0.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <Band
              label="Net change in reach-points"
              values={l2.netReachPoints}
              format={n => signed(n, 1)}
              how="Reach-points gained on receiving channels minus reach-points lost on donor channels, using a saturating response curve through each channel's observed reach. Duplicated reach-points, not audience reach."
            />
            <Band
              label="Gain on receiving channels"
              values={l2.gainReachPoints}
              format={n => signed(n, 1)}
              how="Projected reach added on INCREASE / ADD channels. Never lifts a channel above 60% of its gap to the best competitor, or above 50% of competitor reach on a new channel."
            />
            <Band
              label="Loss on donor channels"
              values={{ low: -l2.lossReachPoints.low, base: -l2.lossReachPoints.base, high: -l2.lossReachPoints.high }}
              format={n => signed(n, 1)}
              how="Projected reach given up on DECREASE channels. A donor is never cut below competitor parity or by more than half of its weight."
            />
            <Band
              label="Competitor gap closed"
              tone="plain"
              values={l2.gapClosedShare}
              format={n => `${Math.round(n * 100)}%`}
              how="Reach gained ÷ current gap to the best competitor, on receiving channels only. Capped at 60% per channel."
            />
            <Band
              label="Donor reach given up"
              tone="plain"
              values={l2.donorReachLossShare}
              format={n => `${Math.round(n * 100)}%`}
              how="Reach lost ÷ current reach, on donor channels only."
            />
          </div>
        )}

        <div style={{ ...howStyle, marginTop: '16px' }}>
          {l2 ? `${l2.touchedChannels} touched channels. ` : ''}
          Low case: receivers saturate sooner (50% of gap attainable) and donors lose more per point. High case: the reverse (100% of gap
          attainable, capped at 60% per channel). See METHODOLOGY.md for formulas and parameters.
        </div>
      </div>
    </div>
  );
}
