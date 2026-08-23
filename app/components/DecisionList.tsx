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
  // When given, each row carries an info target. It stops propagation, so
  // reading about an option never selects it by accident — the two gestures
  // sit 8px apart and one of them is destructive to the other.
  onInfo?: (id: string) => void;
  infoLabel?: string;
}

export default function DecisionList({ options, selectedId, onSelect, disabledIds = [], onInfo, infoLabel }: DecisionListProps) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden' }}>
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
              background: isSelected ? 'rgba(156, 130, 72,0.08)' : 'white',
              opacity: isDisabled ? 0.5 : 1,
              pointerEvents: isDisabled ? 'none' : undefined,
            }}
          >
            <div style={{
              width: '56px', height: '56px',
              borderRadius: option.thumbnailBg ? '50%' : '8px',
              overflow: 'hidden', flexShrink: 0,
              background: option.thumbnailBg ?? '#2B2420',
            }}>
              {!option.thumbnailBg && option.image && (
                <img src={option.image} alt={option.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 600, color: 'var(--char)' }}>
                  {option.title}
                </span>
                {option.badge && (
                  <span style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: '11px',
                    color: 'var(--sage)',
                    background: 'rgba(107,122,90,0.15)',
                    borderRadius: '8px',
                    padding: '2px 8px',
                  }}>
                    {option.badge}
                  </span>
                )}
              </div>
              <div style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '11px',
                color: 'var(--smoke)',
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical' as const,
                lineHeight: 1.35,
              }}>
                {option.tagline}
              </div>
            </div>
            {isSelected && (
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--gold)', flexShrink: 0 }}>
                ✓
              </span>
            )}
            {onInfo && (
              <button
                onClick={e => { e.stopPropagation(); onInfo(option.id); }}
                aria-label={infoLabel ? `${infoLabel} — ${option.title}` : option.title}
                style={{
                  width: '36px', height: '36px', minWidth: '36px', borderRadius: '18px',
                  border: '1px solid var(--border)', background: 'var(--warm)',
                  color: 'var(--brass)', fontFamily: 'var(--font-ui)', fontSize: '13px',
                  fontWeight: 700, cursor: 'pointer', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >i</button>
            )}
          </div>
        );
      })}
    </div>
  );
}
