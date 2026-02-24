import React from 'react';

type TabKey = 'channel' | 'timeband' | 'district';

interface TabNavigationProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  showDistrictTab?: boolean;
}

const TAB_CONFIG: { key: TabKey; icon: string; label: string; hint: string; districtOnly?: boolean }[] = [
  { key: 'channel', icon: '📊', label: 'Channel Analysis', hint: 'View and optimize channel-level performance across all markets and SCRs' },
  { key: 'timeband', icon: '📺', label: 'Timeband Analysis', hint: 'Analyze performance across 4 timebands (NPT, NCPT Early, CPT, NCPT Late) with strategic insights' },
  { key: 'district', icon: '🗺️', label: 'District Analysis', hint: 'Drill into district-level channel and timeband reach for UP (47 districts across 5 SERs)', districtOnly: true },
];

const TabNavigation: React.FC<TabNavigationProps> = ({ activeTab, onTabChange, showDistrictTab = false }) => {
  const visibleTabs = TAB_CONFIG.filter(t => !t.districtOnly || showDistrictTab);
  const activeHint = visibleTabs.find(t => t.key === activeTab)?.hint || '';

  return (
    <div className="panel" style={{ marginBottom: '24px' }}>
      <div style={{
        display: 'flex',
        gap: '0',
        padding: '0'
      }}>
        {visibleTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            style={{
              flex: 1,
              padding: '16px 24px',
              background: activeTab === tab.key ? 'var(--surface-1)' : 'var(--surface-2)',
              border: 'none',
              borderBottom: activeTab === tab.key ? '3px solid var(--orange-bright)' : '3px solid transparent',
              borderRadius: '8px 8px 0 0',
              fontFamily: 'Outfit, sans-serif',
              fontSize: '14px',
              fontWeight: 600,
              color: activeTab === tab.key ? 'var(--orange-bright)' : 'var(--text-tertiary)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => {
              if (activeTab !== tab.key) {
                e.currentTarget.style.background = 'var(--surface-1)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== tab.key) {
                e.currentTarget.style.background = 'var(--surface-2)';
                e.currentTarget.style.color = 'var(--text-tertiary)';
              }
            }}
          >
            <span style={{ fontSize: '16px' }}>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {activeHint && (
        <div style={{
          fontSize: '11px',
          color: 'var(--text-tertiary)',
          padding: '12px 16px',
          background: 'var(--surface-1)',
          borderTop: '1px solid var(--border)',
          fontFamily: 'DM Mono, monospace'
        }}>
          {activeHint}
        </div>
      )}
    </div>
  );
};

export default TabNavigation;
