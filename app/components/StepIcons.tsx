import React from 'react';

export function IconPreferment({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} fill="none"
      stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3h6l1 2H6L7 3z" />
      <path d="M6 5h8l.5 9A1.5 1.5 0 0113 15.5H7A1.5 1.5 0 015.5 14L6 5z" />
      <path d="M8.5 9c0 1 3 1 3 0" />
      <path d="M8 12h4" />
    </svg>
  );
}

export function IconStarter({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} fill="none"
      stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3h6l1 2H6L7 3z" />
      <path d="M6 5h8l.5 9A1.5 1.5 0 0113 15.5H7A1.5 1.5 0 015.5 14L6 5z" />
      <circle cx="9" cy="10" r=".6" fill={color} stroke="none" />
      <circle cx="11" cy="9" r=".6" fill={color} stroke="none" />
      <circle cx="10" cy="12" r=".6" fill={color} stroke="none" />
    </svg>
  );
}

export function IconMix({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} fill="none"
      stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8h12l-1.5 6a2 2 0 01-2 1.5h-5a2 2 0 01-2-1.5L4 8z" />
      <path d="M3.5 8h13" />
      <path d="M10 2v4" />
      <path d="M8.5 3.5c.5 1.5 3 1.5 3 0" />
    </svg>
  );
}

export function IconBulk({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} fill="none"
      stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="9" width="14" height="7.5" rx="1.5" />
      <path d="M2.5 9h15" />
      <path d="M6.5 9V7.5a3.5 3.5 0 017 0V9" />
      <circle cx="7.5" cy="13" r=".6" fill={color} stroke="none" />
      <circle cx="10" cy="11.5" r=".6" fill={color} stroke="none" />
      <circle cx="12.5" cy="13" r=".6" fill={color} stroke="none" />
    </svg>
  );
}

export function IconCold({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} fill="none"
      stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="10" y1="2" x2="10" y2="18" />
      <line x1="2" y1="10" x2="18" y2="10" />
      <line x1="4.3" y1="4.3" x2="15.7" y2="15.7" />
      <line x1="15.7" y1="4.3" x2="4.3" y2="15.7" />
      <path d="M8.5 3.5L10 2l1.5 1.5" />
      <path d="M8.5 16.5L10 18l1.5-1.5" />
      <path d="M3.5 8.5L2 10l1.5 1.5" />
      <path d="M16.5 8.5L18 10l-1.5 1.5" />
    </svg>
  );
}

export function IconDivide({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} fill="none"
      stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="12" r="5" />
      <line x1="10" y1="7" x2="10" y2="17" />
      <path d="M6 3h8" />
      <path d="M14 1.5v4" />
    </svg>
  );
}

export function IconProof({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} fill="none"
      stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="7.5" />
      <line x1="10" y1="10" x2="10" y2="5.5" />
      <line x1="10" y1="10" x2="13.5" y2="12" />
      <circle cx="10" cy="10" r=".75" fill={color} stroke="none" />
    </svg>
  );
}

export function IconPreheat({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} fill="none"
      stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 17c-3.3 0-5.5-2.4-5.5-5.5 0-2.5 1.5-4.5 3-5.5
               0 1.5.5 2.5 1.5 3C9 7 10 5 10.5 2.5 12 4 13.5 6.5 13.5 9
               c.8-.5 1-1.5.8-2.5C15.5 7.5 15.5 9 15.5 11.5c0 3-2.2 5.5-5.5 5.5z" />
    </svg>
  );
}

export function IconBake({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} fill="none"
      stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="9" r="5.5" />
      <line x1="9" y1="3.5" x2="9" y2="14.5" />
      <line x1="3.5" y1="9" x2="14.5" y2="9" />
      <path d="M13.5 13.5L17 17" />
    </svg>
  );
}

export function IconWater({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} fill="none"
      stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 3C10 3 5 9 5 13a5 5 0 0010 0c0-4-5-10-5-10z" />
    </svg>
  );
}

export function IconYeast({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} fill="none"
      stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="6" />
      <circle cx="10" cy="10" r="2" />
      <line x1="10" y1="4" x2="10" y2="8" />
      <line x1="10" y1="12" x2="10" y2="16" />
      <line x1="4" y1="10" x2="8" y2="10" />
      <line x1="12" y1="10" x2="16" y2="10" />
    </svg>
  );
}

export function IconSalt({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} fill="none"
      stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 4h4v12H8z" rx="1" />
      <path d="M8 4a2 2 0 014 0" />
      <circle cx="10" cy="9" r=".6" fill={color} stroke="none" />
      <circle cx="10" cy="12" r=".6" fill={color} stroke="none" />
    </svg>
  );
}

export function IconOil({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} fill="none"
      stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3h4l1 3H7L8 3z" />
      <path d="M7 6h6l1 9a1.5 1.5 0 01-1.5 1.5h-5A1.5 1.5 0 016 15l1-9z" />
      <path d="M10 9v4" />
    </svg>
  );
}

export function IconKnead({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} fill="none"
      stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="10" cy="13" rx="7" ry="4" />
      <path d="M6 10c-1-2 0-5 4-5s5 3 4 5" />
      <path d="M8 8c0-1.5 1-2.5 2-2.5s2 1 2 2.5" />
    </svg>
  );
}

// Icon key lookup — used by Timeline which stores icons as string keys
export const STEP_ICON_MAP: Record<string, (props: { size?: number; color?: string }) => React.ReactElement> = {
  mix:        IconMix,
  bulk:       IconBulk,
  cold:       IconCold,
  divide:     IconDivide,
  proof:      IconProof,
  preheat:    IconPreheat,
  bake:       IconBake,
  preferment: IconPreferment,
  starter:    IconStarter,
  water:      IconWater,
  yeast:      IconYeast,
  salt:       IconSalt,
  oil:        IconOil,
  knead:      IconKnead,
};

// Render an icon by key — for Timeline data-driven usage
export function StepIcon({ iconKey, size = 18, color = 'currentColor' }: {
  iconKey: string; size?: number; color?: string;
}) {
  const Cmp = STEP_ICON_MAP[iconKey];
  if (!Cmp) return null;
  return <Cmp size={size} color={color} />;
}
