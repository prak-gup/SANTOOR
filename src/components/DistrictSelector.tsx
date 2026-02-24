import React from 'react';
import type { DistrictRecord } from '../utils/districtCalculations';

interface DistrictSelectorProps {
  sers: string[];
  selectedSer: string | null;
  onSerSelect: (ser: string) => void;
  districts: DistrictRecord[];
  selectedDistrict: string | null;
  onDistrictSelect: (district: string) => void;
}

const DistrictSelector: React.FC<DistrictSelectorProps> = ({
  sers,
  selectedSer,
  onSerSelect,
  districts,
  selectedDistrict,
  onDistrictSelect,
}) => {
  const filteredDistricts = selectedSer
    ? districts.filter(d => d.ser === selectedSer)
    : [];

  return (
    <div className="panel" style={{ marginBottom: '24px' }}>
      <div className="p-6">
        {/* SER Selection */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{
            fontFamily: 'Outfit, sans-serif',
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--text-tertiary)',
            marginBottom: '8px',
            display: 'block'
          }}>
            SELECT SER REGION
          </label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {sers.map(ser => (
              <button
                key={ser}
                onClick={() => onSerSelect(ser)}
                className={`btn-tactical ${selectedSer === ser ? 'active' : ''}`}
              >
                {ser}
              </button>
            ))}
          </div>
        </div>

        {/* District Selection */}
        {selectedSer && filteredDistricts.length > 0 && (
          <div>
            <label style={{
              fontFamily: 'Outfit, sans-serif',
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--text-tertiary)',
              marginBottom: '8px',
              display: 'block'
            }}>
              SELECT DISTRICT ({filteredDistricts.length} districts)
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {filteredDistricts
                .sort((a, b) => b.cdmiScore - a.cdmiScore)
                .map(d => {
                  const isSelected = selectedDistrict === d.district;

                  return (
                    <button
                      key={d.district}
                      onClick={() => onDistrictSelect(d.district)}
                      style={{
                        padding: '8px 14px',
                        background: isSelected ? 'var(--orange-bright)' : 'var(--surface-2)',
                        border: isSelected ? '1px solid var(--orange-bright)' : '1px solid var(--border)',
                        borderRadius: '6px',
                        fontFamily: 'DM Mono, monospace',
                        fontSize: '11px',
                        fontWeight: isSelected ? 600 : 400,
                        color: isSelected ? 'white' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <span>{d.district}</span>
                    </button>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DistrictSelector;
