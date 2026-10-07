import type { CSSProperties, ReactNode } from 'react';
import type { ScenarioResult } from '../utils/scenario';

interface BaselineSummary {
  rel: number;
  active: number;
  opp: number;
  avgGap: number;
  avgATC: number | null;
  status: string;
}

interface Props {
  scenario: ScenarioResult;
  baseline: BaselineSummary;
  statusClasses: Record<string, string>;
}

const howStyle: CSSProperties = {
  marginTop: '10px',
  fontSize: '10px',
  lineHeight: 1.45,
  color: 'var(--text-dim)',
  fontFamily: 'DM Mono, monospace',
  textAlign: 'left',
};

const sectionLabel: CSSProperties = {
  fontFamily: 'Outfit, sans-serif',
  fontSize: '12px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--text-tertiary)',
  margin: '0 0 12px 0',
};

const grid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
  gap: '16px',
  marginBottom: '28px',
};

const signed = (n: number, dp = 0) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(dp)}`;
const pct = (share: number, dp = 0) => `${(share * 100).toFixed(dp)}%`;

function deltaColor(delta: number, goodWhen: 'up' | 'down', dp: number): string {
  const rounded = Number(delta.toFixed(dp));
  if (rounded === 0) return 'var(--text-tertiary)';
  const good = goodWhen === 'up' ? rounded > 0 : rounded < 0;
  return good ? 'var(--signal-positive)' : 'var(--signal-negative)';
}

function Card(props: {
  label: string;
  value: ReactNode;
  color?: string;
  sub?: ReactNode;
  how: string;
}) {
  return (
    <div className="metric-card" style={{ textAlign: 'center' }} title={props.how}>
      <div className="metric-label">{props.label}</div>
      <div className="metric-value" style={{ color: props.color ?? 'var(--text-primary)' }}>
        {props.value}
      </div>
      {props.sub && <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--text-tertiary)' }}>{props.sub}</div>}
      <div style={howStyle}>{props.how}</div>
    </div>
  );
}

function BaseToScenario(props: {
  label: string;
  baseline: number;
  scenario: number;
  dp: number;
  goodWhen: 'up' | 'down';
  modelled?: boolean;
  how: string;
  badge?: ReactNode;
}) {
  const d = props.scenario - props.baseline;
  const shown = Number(d.toFixed(props.dp));
  return (
    <div className="metric-card" style={{ textAlign: 'center' }} title={props.how}>
      <div className="metric-label">
        {props.label}
        {props.modelled && <span style={{ color: 'var(--signal-purple)' }}> · MODELLED</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '14px', color: 'var(--text-tertiary)', fontFamily: 'DM Mono, monospace' }}>
          {props.baseline.toFixed(props.dp)}
        </span>
        <span style={{ color: 'var(--text-dim)' }}>→</span>
        <span className="metric-value" style={{ color: 'var(--text-primary)' }}>
          {props.scenario.toFixed(props.dp)}
        </span>
      </div>
      <div style={{ marginTop: '6px', fontWeight: 600, fontSize: '13px', color: deltaColor(d, props.goodWhen, props.dp) }}>
        {shown === 0 ? 'no change' : signed(d, props.dp)}
      </div>
      {props.badge && <div style={{ marginTop: '8px' }}>{props.badge}</div>}
      <div style={howStyle}>{props.how}</div>
    </div>
  );
}

export default function ScenarioKpis({ scenario: s, baseline, statusClasses }: Props) {
  const total = s.counts.ADD + s.counts.INCREASE + s.counts.MAINTAIN + s.counts.DECREASE;
  const scenarioStatus = (g: number) => (g >= 2 ? 'LEADING' : g >= 0 ? 'CLOSE' : g >= -2 ? 'BEHIND' : 'CRITICAL');

  return (
    <div style={{ marginBottom: '32px' }}>
      <h3 style={sectionLabel}>Observed baseline → scenario at these levers</h3>
      <div style={grid}>
        <Card
          label="Channels in scope"
          value={s.eligibleCount}
          sub="unchanged by levers"
          how="Channels with real Santoor presence or a real white-space opening (Santoor reach >1%, or >0.5% with share >0.5%, or competitor ≥2% with share ≥1%). Not affected by search or genre filters."
        />
        <BaseToScenario
          label="Santoor active"
          baseline={baseline.active}
          scenario={s.scenario.active}
          dp={0}
          goodWhen="up"
          how="In-scope channels where Santoor reach > 0, plus every channel the scenario newly ADDs."
        />
        <BaseToScenario
          label="White space"
          baseline={baseline.opp}
          scenario={s.scenario.whitespace}
          dp={0}
          goodWhen="down"
          how="In-scope channels where Santoor is absent but a competitor reaches ≥2% (channel share ≥1%). Falls by the number of channels the scenario ADDs."
        />
        <BaseToScenario
          label="Avg reach gap (pts)"
          baseline={baseline.avgGap}
          scenario={s.scenario.avgGap}
          dp={1}
          goodWhen="up"
          modelled
          badge={
            <span className={statusClasses[scenarioStatus(s.scenario.avgGap)] || 'signal-badge signal-neutral'}>
              {scenarioStatus(s.scenario.avgGap)}
            </span>
          }
          how="Simple average of Santoor minus best-competitor reach across the baseline active channels. Scenario value uses the base curve from the panel below, so treat it as indicative."
        />
        {baseline.avgATC !== null && (
          <Card
            label="Avg ATC index"
            value={baseline.avgATC.toFixed(1)}
            color="var(--signal-purple)"
            sub="observed, not modelled"
            how="Average ATC index across active Karnataka channels. The scenario does not model ATC."
          />
        )}
      </div>

      <h3 style={sectionLabel}>Decisions at these levers</h3>
      <div style={grid}>
        <Card
          label="Protected"
          value={s.protectedCount}
          color="var(--signal-info)"
          sub={`hold ${pct(s.protectedWeightShare)} of reach-point weight`}
          how={`Top ${s.levers.threshold}% of Santoor-active channels by reach are frozen first: never cut, though they can still receive weight where Santoor trails.`}
        />
        <Card
          label="Add"
          value={s.counts.ADD}
          color="var(--signal-purple)"
          how="White-space channels that receive enough weight to reach at least 0.5 reach-pts of entry reach."
        />
        <Card
          label="Increase"
          value={s.counts.INCREASE}
          color="var(--signal-positive)"
          how="Active channels where Santoor trails by ≥1.0 pt and extra weight earns more reach than a donor gives up (≥1.15×)."
        />
        <Card
          label="Maintain"
          value={s.counts.MAINTAIN}
          color="var(--signal-info)"
          sub={`${s.protectedCount} protected`}
          how="Everything else: protected, near parity, flagged data, or no net benefit from moving weight."
        />
        <Card
          label="Decrease"
          value={s.counts.DECREASE}
          color="var(--signal-negative)"
          how="Unprotected channels where Santoor leads its competitor; they give up weight, never more than 50% and never below competitor parity."
        />
        <Card
          label="High priority"
          value={s.highPriority}
          color="var(--orange-bright)"
          how="Acted-on channels with a gap of 5+ pts (INCREASE) or competitor reach above 5% (ADD)."
        />
        <Card
          label="Intervention rate"
          value={pct(s.interventionRate)}
          color="var(--orange-bright)"
          how="(Add + Increase + Decrease) ÷ channels in scope."
        />
        <Card
          label="Weight moved"
          value={`${pct(s.movedShareUnprotected)}`}
          color="var(--orange-bright)"
          sub={`of unprotected weight · ${s.movedWeight.toFixed(1)} reach-pts · ${pct(s.movedShareRoster, 1)} of roster`}
          how={`Intensity asks for ${s.levers.intensity}% of unprotected reach-point weight (${s.requestedWeight.toFixed(1)} pts). What actually moves is limited by eligible donors and receivers.`}
        />
      </div>

      <div style={{ ...howStyle, marginTop: '-12px', marginBottom: '12px' }}>
        {s.counts.ADD} add + {s.counts.INCREASE} increase + {s.counts.MAINTAIN} maintain + {s.counts.DECREASE} decrease = {total} channels in scope
        {total === s.eligibleCount ? ' ✓' : ''}
      </div>

      {s.notice && (
        <div
          role="status"
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            borderLeft: '3px solid var(--orange-bright)',
            background: 'var(--surface-2)',
            fontSize: '12px',
            lineHeight: 1.5,
            color: 'var(--text-secondary)',
          }}
        >
          {s.notice}
        </div>
      )}
    </div>
  );
}
