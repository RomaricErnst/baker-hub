'use client';
import InfoDot from './InfoDot';

interface Option {
  id: string;
  image: string;
  title: string;
  tagline: string;
  badge?: string;
  thumbnailBg?: string;
}

interface DecisionListProps {
  layout?: 'compact' | 'lateral' | 'photo';
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

export default function DecisionList({ options, selectedId, onSelect, disabledIds = [], onInfo, infoLabel, layout = 'compact' }: DecisionListProps) {
  return (
    <div role="group" style={{ display: 'grid', gap: layout === 'compact' ? 0 : 10, border: layout === 'compact' ? '1px solid var(--border)' : undefined, borderRadius: '16px', overflow: 'hidden' }}>
      {options.map((option, idx) => {
        const isSelected = option.id === selectedId;
        const isDisabled = disabledIds.includes(option.id);
        return (
          <div
            key={option.id}
            role="button" tabIndex={isDisabled ? -1 : 0} aria-pressed={isSelected} aria-disabled={isDisabled}
            onKeyDown={e => { if(e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')){e.preventDefault();if(!isDisabled)onSelect(option.id);} }}
            onClick={() => !isDisabled && onSelect(option.id)}
            style={{
              display: 'flex',
              flexWrap: layout === 'photo' ? 'wrap' : undefined,
              border: layout === 'compact' ? undefined : `2px solid ${isSelected ? 'var(--terra)' : 'var(--border)'}`,
              borderRadius: layout === 'compact' ? 0 : 12,
              alignItems: 'center',
              gap: '12px',
              padding: isSelected ? '10px 14px 10px 11px' : '10px 14px',
              minHeight: '62px',
              cursor: isDisabled ? 'default' : 'pointer',
              borderBottom: layout === 'compact' ? (idx < options.length - 1 ? '1px solid var(--border)' : 'none') : undefined,
              borderLeft: layout === 'compact' ? (isSelected ? '3px solid var(--gold)' : 'none') : undefined,
              background: isSelected ? 'rgba(156, 130, 72,0.08)' : 'white',
              opacity: isDisabled ? 0.5 : 1,
              pointerEvents: isDisabled ? 'none' : undefined,
            }}
          >
            <div style={{
              width: layout === 'photo' ? '100%' : layout === 'lateral' ? 100 : 56, height: layout === 'photo' ? 'auto' : layout === 'lateral' ? 100 : 56, aspectRatio: layout === 'photo' ? '2 / 1' : undefined,
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
                fontSize: layout === 'compact' ? '11px' : '13px',
                color: 'var(--smoke)',
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: layout === 'compact' ? 2 : 4,
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
              <InfoDot
                onClick={() => onInfo(option.id)}
                label={infoLabel ? `${infoLabel} — ${option.title}` : option.title}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
