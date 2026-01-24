import React from 'react';

interface TabNavigationProps {
  activeTab: 'channel' | 'timeband';
  onTabChange: (tab: 'channel' | 'timeband') => void;
}

const TabNavigation: React.FC<TabNavigationProps> = ({ activeTab, onTabChange }) => {
  return (
    <div className="panel" style={{ marginBottom: '24px' }}>
      <div style={{
        display: 'flex',
        gap: '0',
        padding: '0'
      }}>
        <button
          onClick={() => onTabChange('channel')}
          style={{
            flex: 1,
            padding: '16px 24px',
            background: activeTab === 'channel' ? 'var(--surface-1)' : 'var(--surface-2)',
            border: 'none',
            borderBottom: activeTab === 'channel' ? '3px solid var(--orange-bright)' : '3px solid transparent',
            borderRadius: '8px 8px 0 0',
            fontFamily: 'Outfit, sans-serif',
            fontSize: '14px',
            fontWeight: 600,
            color: activeTab === 'channel' ? 'var(--orange-bright)' : 'var(--text-tertiary)',
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
            if (activeTab !== 'channel') {
              e.currentTarget.style.background = 'var(--surface-1)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== 'channel') {
              e.currentTarget.style.background = 'var(--surface-2)';
              e.currentTarget.style.color = 'var(--text-tertiary)';
            }
          }}
        >
          <span style={{ fontSize: '16px' }}>📊</span>
          <span>Channel Analysis</span>
        </button>

        <button
          onClick={() => onTabChange('timeband')}
          style={{
            flex: 1,
            padding: '16px 24px',
            background: activeTab === 'timeband' ? 'var(--surface-1)' : 'var(--surface-2)',
            border: 'none',
            borderBottom: activeTab === 'timeband' ? '3px solid var(--orange-bright)' : '3px solid transparent',
            borderRadius: '8px 8px 0 0',
            fontFamily: 'Outfit, sans-serif',
            fontSize: '14px',
            fontWeight: 600,
            color: activeTab === 'timeband' ? 'var(--orange-bright)' : 'var(--text-tertiary)',
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
            if (activeTab !== 'timeband') {
              e.currentTarget.style.background = 'var(--surface-1)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== 'timeband') {
              e.currentTarget.style.background = 'var(--surface-2)';
              e.currentTarget.style.color = 'var(--text-tertiary)';
            }
          }}
        >
          <span style={{ fontSize: '16px' }}>📺</span>
          <span>Timeband Analysis</span>
        </button>
      </div>

      {/* Tab indicator - visual guide for active tab */}
      {activeTab === 'channel' && (
        <div style={{
          fontSize: '11px',
          color: 'var(--text-tertiary)',
          padding: '12px 16px',
          background: 'var(--surface-1)',
          borderTop: '1px solid var(--border)',
          fontFamily: 'DM Mono, monospace'
        }}>
          View and optimize channel-level performance across all markets and SCRs
        </div>
      )}

      {activeTab === 'timeband' && (
        <div style={{
          fontSize: '11px',
          color: 'var(--text-tertiary)',
          padding: '12px 16px',
          background: 'var(--surface-1)',
          borderTop: '1px solid var(--border)',
          fontFamily: 'DM Mono, monospace'
        }}>
          Analyze performance across 4 timebands (NPT, NCPT Early, CPT, NCPT Late) with strategic insights
        </div>
      )}
    </div>
  );
};

export default TabNavigation;
