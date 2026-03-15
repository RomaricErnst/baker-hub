'use client';

interface LearnModalProps {
  term: string;
  onClose: () => void;
}

type TermContent = {
  title: string;
  emoji: string;
  explanation: string;
  tip: string;
  secondTip?: string;
  videoLabel?: string;
  videoUrl?: string;
};

const TERMS: Record<string, TermContent> = {
  windowpane: {
    title: 'The Windowpane Test',
    emoji: '🪟',
    explanation: 'Stretch a small piece of dough between your fingers until it\'s thin enough to see light through without tearing. If it stretches thin and translucent like a window — gluten is fully developed. If it tears immediately — knead more.',
    tip: 'Take a golf-ball sized piece of dough. Slowly stretch it in all directions from the center. Rotate as you stretch.',
    videoLabel: 'Read full guide →',
    videoUrl: 'https://www.pizzablab.com/the-encyclopizza/windowpane-test/',
  },
  pumpkin: {
    title: 'The Pumpkin Shape',
    emoji: '🎃',
    explanation: 'As your dough develops in a spiral mixer, it will gradually pull away from the sides of the bowl and wrap tightly around the breaker bar, forming a smooth rounded ball resembling a pumpkin. This shape tells you the gluten network is developing correctly — the dough has enough strength to hold itself together against the centrifugal force of the rotating bowl.',
    tip: 'Watch for the transition: at first the dough looks shaggy and sticks to the bowl walls. As mixing progresses it slowly gathers and climbs the breaker bar. A full pumpkin shape means you are roughly 60–70% developed — continue mixing until the surface is smooth and the dough pulls completely clean from the bowl.',
    secondTip: 'If adding water gradually (bassinage), wait for the pumpkin to reform after each water addition before adding more. If the pumpkin collapses and the dough spreads flat, you have added water too fast — stop and let the dough recover before continuing.',
  },
  autolyse: {
    title: 'Autolyse',
    emoji: '⏳',
    explanation: 'Mixing flour and water and letting it rest before adding other ingredients. During this rest, flour hydrates naturally and gluten begins forming without any kneading. The result is more extensible, easier to work dough.',
    tip: '20–30 min is enough for pizza. Bread benefits from up to 1 hour. Keep it covered to prevent drying.',
    videoLabel: 'Read full guide →',
    videoUrl: 'https://www.pizzablab.com/the-encyclopizza/autolyse/',
  },
  bassinage: {
    title: 'Bassinage',
    emoji: '💧',
    explanation: 'A French technique meaning \'wetting\'. Instead of adding all the water at once, hold back 10–20% and add it gradually after the dough has developed initial structure. This lets the gluten form properly in a slightly drier dough first, then absorbs the extra water without becoming a sticky unworkable mass.',
    tip: 'Wait until the dough forms a cohesive ball (or pumpkin shape in a spiral mixer) before adding the reserved water. Add it in small pours of 30–50g at a time — wait for each addition to be fully absorbed before adding more.',
    secondTip: 'Bassinage is most useful for doughs above 70% hydration. Below 70% just add all the water at once — the technique adds complexity without much benefit at lower hydrations.',
  },
  bulk_fermentation: {
    title: 'Bulk Fermentation',
    emoji: '🌡',
    explanation: 'The first long rise after mixing, where the whole dough mass ferments together before being divided. During this time yeast produces CO2 (rise) and enzymes break down starches and proteins (flavour). This is where most of the flavour develops.',
    tip: 'Bulk is done when dough has grown 50–75%, feels airy when you shake the container, and the surface looks slightly domed and bubbly.',
    videoLabel: 'Read full guide →',
    videoUrl: 'https://www.theperfectloaf.com/guides/the-ultimate-guide-to-bread-dough-bulk-fermentation/',
  },
};

export default function LearnModal({ term, onClose }: LearnModalProps) {
  const content = TERMS[term];
  if (!content) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(26,22,18,0.55)',
        zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: '18px',
          maxWidth: '480px',
          width: '100%',
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
        }}
      >
        {/* Header */}
        <div style={{
          background: 'var(--char)',
          padding: '1.25rem 1.4rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
            <span style={{ fontSize: '1.6rem', lineHeight: 1 }}>{content.emoji}</span>
            <span style={{
              fontFamily: 'var(--font-playfair)',
              fontSize: '1.1rem', fontWeight: 700,
              color: 'var(--cream)',
            }}>
              {content.title}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,.1)',
              border: 'none', borderRadius: '8px',
              color: 'var(--cream)', fontSize: '1rem',
              width: '30px', height: '30px',
              cursor: 'pointer', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.25rem 1.4rem', display: 'flex', flexDirection: 'column', gap: '.85rem' }}>
          {/* Explanation */}
          <p style={{
            fontSize: '.88rem', color: 'var(--ash)',
            lineHeight: 1.7, margin: 0,
          }}>
            {content.explanation}
          </p>

          {/* Tip box */}
          <div style={{
            background: 'var(--cream)',
            border: '1.5px solid var(--border)',
            borderRadius: '12px',
            padding: '.85rem 1rem',
          }}>
            <div style={{
              fontSize: '.7rem', fontWeight: 600,
              color: 'var(--smoke)', textTransform: 'uppercase',
              letterSpacing: '.07em', marginBottom: '.4rem',
              fontFamily: 'var(--font-dm-mono)',
            }}>
              Practical tip
            </div>
            <p style={{
              fontSize: '.83rem', color: 'var(--ash)',
              lineHeight: 1.6, margin: 0,
            }}>
              {content.tip}
            </p>
          </div>

          {/* Second tip box — sage tint, only if present */}
          {content.secondTip && (
            <div style={{
              background: '#F0F5EA',
              border: '1.5px solid #C8D4BA',
              borderRadius: '12px',
              padding: '.85rem 1rem',
            }}>
              <div style={{
                fontSize: '.7rem', fontWeight: 600,
                color: '#4A5A44', textTransform: 'uppercase',
                letterSpacing: '.07em', marginBottom: '.4rem',
                fontFamily: 'var(--font-dm-mono)',
              }}>
                Also note
              </div>
              <p style={{
                fontSize: '.83rem', color: 'var(--ash)',
                lineHeight: 1.6, margin: 0,
              }}>
                {content.secondTip}
              </p>
            </div>
          )}

          {/* External link — only if present */}
          {content.videoUrl && content.videoLabel && (
            <a
              href={content.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: '.5rem',
                padding: '.65rem 1rem',
                background: 'var(--terra)', color: '#fff',
                borderRadius: '10px', textDecoration: 'none',
                fontSize: '.83rem', fontWeight: 600,
              }}
            >
              {content.videoLabel}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
