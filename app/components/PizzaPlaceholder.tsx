// Elegant stand-in for custom pizzas without a photo — warm tile, Playfair
// initial, no broken-image glyph, no question mark.
export default function PizzaPlaceholder({ name, size = 'card' }: { name: string; size?: 'thumb' | 'card' | 'hero' }) {
  const initial = (name.trim()[0] ?? 'P').toUpperCase();
  const fs = size === 'thumb' ? 30 : size === 'hero' ? 64 : 48;
  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'radial-gradient(120% 120% at 30% 20%, #3D3530 0%, #1A1612 70%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative',
    }}>
      <span style={{
        fontFamily: 'var(--font-playfair), Playfair Display, serif',
        fontSize: fs, fontWeight: 700, color: 'rgba(212,168,83,0.85)', lineHeight: 1,
      }}>{initial}</span>
      <span style={{
        position: 'absolute', bottom: 6, right: 8,
        fontFamily: 'var(--font-dm-mono)', fontSize: 8, letterSpacing: '.08em',
        color: 'rgba(245,240,232,0.35)', textTransform: 'uppercase',
      }}>✎</span>
    </div>
  );
}
