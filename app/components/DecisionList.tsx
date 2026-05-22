'use client';

interface Option {
  id: string;
  image: string;
  title: string;
  tagline: string;
  badge?: string;
  thumbnailBg?: string;
}

interface DecisionListProps {
  options: Option[];
  selectedId: string;
  onSelect: (id: string) => void;
  disabledIds?: string[];
}

export default function DecisionList({ options, selectedId, onSelect, disabledIds = [] }: DecisionListProps) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
      {options.map((option, idx) => {
        const isSelected = option.id === selectedId;
        const isDisabled = disabledIds.includes(option.id);
        return (
          <div
            key={option.id}
            onClick={() => !isDisabled && onSelect(option.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: isSelected ? '10px 14px 10px 11px' : '10px 14px',
              minHeight: '62px',
              cursor: isDisabled ? 'default' : 'pointer',
              borderBottom: idx < options.length - 1 ? '1px solid var(--border)' : 'none',
              borderLeft: isSelected ? '3px solid var(--gold)' : 'none',
              background: isSelected ? 'rgba(212,168,83,0.08)' : 'white',
              opacity: isDisabled ? 0.5 : 1,
              pointerEvents: isDisabled ? 'none' : undefined,
            }}
          >
            <div style={{
              width: '56px', height: '56px',
              borderRadius: option.thumbnailBg ? '50%' : '8px',
              overflow: 'hidden', flexShrink: 0,
              background: option.thumbnailBg ?? '#1A1612',
            }}>
              {!option.thumbnailBg && option.image && (
                <img src={option.image} alt={option.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontFamily: 'Playfair Display, serif', fontSize: '14px', fontWeight: 600, color: 'var(--char)' }}>
                  {option.title}
                </span>
                {option.badge && (
                  <span style={{
                    fontFamily: 'DM Mono, monospace',
                    fontSize: '9px',
                    color: 'var(--sage)',
                    background: 'rgba(107,122,90,0.15)',
                    borderRadius: '10px',
                    padding: '2px 7px',
                  }}>
                    {option.badge}
                  </span>
                )}
              </div>
              <div style={{
                fontFamily: 'DM Sans, sans-serif',
                fontSize: '11px',
                color: 'var(--smoke)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {option.tagline}
              </div>
            </div>
            {isSelected && (
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '14px', color: 'var(--gold)', flexShrink: 0 }}>
                ✓
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
