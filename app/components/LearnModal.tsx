'use client';

import { useEffect } from 'react';
import { useLocale } from 'next-intl';
import { TERMS_FR } from './learnModalFr';

interface LearnModalProps {
  term: string;
  onClose: () => void;
  footer?: React.ReactNode;
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
    emoji: '',
    explanation: "For wheat dough, gently stretch a small piece to check whether it forms a thin membrane. This is one development cue; flour type and dough temperature also matter.",
    tip: "If the dough resists stretching, rest it covered and try again. Do not keep kneading solely to obtain a membrane, especially with rye or whole-grain dough.",
    videoLabel: 'Read full guide →',
    videoUrl: 'https://www.pizzablab.com/the-encyclopizza/windowpane-test/',
  },
  pumpkin: {
    title: 'The Pumpkin Shape',
    emoji: '',
    explanation: "In a spiral mixer, dough can gather into a rounded mass around the bar. This indicates that it is gaining cohesion, but does not measure a percentage of development.",
    tip: "Check dough elasticity and temperature as well as its shape. Follow the mixer’s permitted dough speeds.",
    secondTip: "When adding reserved water, allow each addition to incorporate before adding more.",
  },
  autolyse: {
    title: 'Autolyse',
    emoji: '',
    explanation: "A rest after combining flour and water, before adding the other ingredients. Use it when it is included in this recipe’s mixing sequence.",
    tip: "Keep the dough covered and follow the planned duration. Do not add an extra rest to a recipe that does not schedule one.",
    videoLabel: 'Read full guide →',
    videoUrl: 'https://www.pizzablab.com/the-encyclopizza/autolyse/',
  },
  bassinage: {
    title: 'Bassinage',
    emoji: '',
    explanation: "Adding part of the recipe’s water gradually after the dough begins to hold together. This is reserved water, not extra water.",
    tip: "Use the quantity reserved in your mixing instructions. Add small amounts and let each addition incorporate.",
    secondTip: "Follow your recipe’s sequence; there is no need to add this technique to every dough.",
  },
  fdt: {
    title: 'Final Dough Temperature',
    emoji: '',
    explanation: "Final dough temperature is measured immediately after mixing. Compare it with the target shown in your recipe.",
    tip: "Prepare the water using the recipe’s instructions, then measure the dough with a thermometer. The calculated temperature is an estimate.",
    secondTip: "If the dough is warmer than planned, check its rise sooner; if cooler, allow more time. Check the recipe’s readiness cues before moving on.",
    videoLabel: 'Read full guide →',
    videoUrl: 'https://www.pizzablab.com/learning-and-resources/mixing-kneading/pizza-dough-kneading-fundamentals/',
  },
  poke_test: {
    title: 'The Poke Test',
    emoji: '',
    explanation: "Gently press the dough with a floured fingertip and observe its response. Combine this observation with the rise, surface and recipe’s proofing cues.",
    tip: "For bread, a slow, partial return with visible rise can indicate readiness. If the dough is still firm, springs back quickly and has barely risen, allow more proofing time.",
    secondTip: "Temperature and flour affect the result. Do not use the finger test alone to decide whether to bake.",
  },
  bulk_fermentation: {
    title: 'Bulk Fermentation',
    emoji: '',
    explanation: "The dough ferments as one mass before dividing and shaping. Follow the volume and texture cues given for this stage.",
    tip: "Mark the starting level in a straight-sided container. Check the rise, bubbles and dough strength together rather than using a fixed increase for every recipe.",
    videoLabel: 'Read full guide →',
    videoUrl: 'https://www.theperfectloaf.com/guides/the-ultimate-guide-to-bread-dough-bulk-fermentation/',
  },
  preferment_ready: {
    title: 'Is it ready?',
    emoji: '',
    explanation: "Check the preferment itself as well as the planned time. Its appearance depends on whether it is poolish, biga or starter.",
    tip: "Poolish: bubbly surface beginning to flatten after rising. Biga: expanded mass with aeration inside a broken-open piece. Starter: clear rise and bubbles; the float test alone is not sufficient.",
    secondTip: "If maturity does not match the plan, reassess the schedule before mixing. Smell alone cannot determine readiness.",
  },
  shape_check: {
    title: 'Check your shape',
    emoji: '',
    explanation: "Shape with an even surface and close the seam without tearing the dough. Use the method shown for your bread or pizza.",
    tip: "Stop tightening if the surface begins to tear. Dough strength and hydration affect how firmly it holds its shape.",
    secondTip: "If the dough resists, cover it and let it relax before continuing gently.",
  },
  score_technique: {
    title: 'Scoring technique',
    emoji: '',
    explanation: "Score the dough just before baking, following the pattern and depth for your bread. Use a sharp blade and a controlled motion.",
    tip: "Support the dough without pressing it down. Avoid repeated passes that drag or tear the surface.",
    secondTip: "Scoring helps direct expansion in the oven; it does not correct under- or over-proofing.",
  },
  stretch_bake: {
    title: 'Stretch & bake tips',
    emoji: '',
    explanation: "Open the dough using the method for your pizza style. Preserve the rim where the style calls for one; thin Roman pizza may be rolled out.",
    tip: "Drain wet toppings, top the pizza and check that it moves freely on the peel before launching.",
    secondTip: "If the dough resists stretching, cover and rest it before trying again. Use the recipe’s warm-up and baking cues.",
  },
};

export default function LearnModal({ term, onClose, footer }: LearnModalProps) {
  const locale = useLocale();
  const isFr = locale === 'fr';
  const en = TERMS[term];
  // Fall back per field, not per term: an English paragraph beside a French
  // one is bad, but a missing paragraph is worse. If a term ever gains
  // content on one side only, the modal still renders.
  const fr = TERMS_FR[term];
  const content = en && {
    ...en,
    title: (isFr && fr?.title) || en.title,
    explanation: (isFr && fr?.explanation) || en.explanation,
    tip: (isFr && fr?.tip) || en.tip,
    secondTip: (isFr && fr?.secondTip) || en.secondTip,
    videoLabel: (isFr && fr?.videoLabel) || en.videoLabel,
  };
  // Escape closes, as it does on every other sheet in the app.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  if (!content) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(43, 36, 32,0.55)',
        zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        role="dialog" aria-modal="true"
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: '16px',
          maxWidth: '480px',
          width: '100%',
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
        }}
      >
        {/* Header */}
        <div style={{
          background: 'var(--char)',
          padding: '20px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {content.emoji && <span style={{ fontSize: '26px', lineHeight: 1 }}>{content.emoji}</span>}
            <span style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '17px', fontWeight: 700,
              color: 'var(--cream)',
            }}>
              {content.title}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label={isFr ? 'Fermer' : 'Close'}
            style={{
              background: 'rgba(255,255,255,.1)',
              backgroundClip: 'content-box',
              border: 'none', borderRadius: '12px',
              color: 'var(--cream)', fontSize: '15px',
              // 44px tap box, 30px painted square (padding + content-box clip)
              width: '44px', height: '44px', padding: '8px', margin: '-7px',
              cursor: 'pointer', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Explanation */}
          <p style={{
            fontSize: '14px', color: 'var(--ash)',
            lineHeight: 1.7, margin: 0,
          }}>
            {content.explanation}
          </p>

          {/* Tip box */}
          <div style={{
            background: 'var(--cream)',
            border: '1.5px solid var(--border)',
            borderRadius: '16px',
            padding: '12px 16px',
          }}>
            <div style={{
              fontSize: '11px', fontWeight: 600,
              color: 'var(--smoke)', textTransform: 'uppercase',
              letterSpacing: '.07em', marginBottom: '8px',
              fontFamily: 'var(--font-ui)',
            }}>
              Practical tip
            </div>
            <p style={{
              fontSize: '13px', color: 'var(--ash)',
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
              borderRadius: '16px',
              padding: '12px 16px',
            }}>
              <div style={{
                fontSize: '11px', fontWeight: 600,
                color: '#4A5A44', textTransform: 'uppercase',
                letterSpacing: '.07em', marginBottom: '8px',
                fontFamily: 'var(--font-ui)',
              }}>
                Also note
              </div>
              <p style={{
                fontSize: '13px', color: 'var(--ash)',
                lineHeight: 1.6, margin: 0,
              }}>
                {content.secondTip}
              </p>
            </div>
          )}

          {/* Footer slot — Maestro or other contextual content */}
          {footer}

          {/* External reference — quiet line naming its source, with the
              leaving-the-app affordance. It's a reference, not a deeper
              level of the app. */}
          {content.videoUrl && (
            <a
              href={content.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block', textAlign: 'center',
                padding: '8px 0 .1rem',
                color: 'var(--terra)', textDecoration: 'underline',
                textUnderlineOffset: '3px',
                fontSize: '12px', fontFamily: 'var(--font-ui)',
              }}
            >
              {(() => {
                try {
                  const host = new URL(content.videoUrl).hostname.replace('www.', '').split('.')[0];
                  const site = host.charAt(0).toUpperCase() + host.slice(1);
                  return `${isFr ? 'Source : ' : 'Source: '} ${site} ↗`;
                } catch { return `${isFr ? 'Source' : 'Source'} ↗`; }
              })()}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
