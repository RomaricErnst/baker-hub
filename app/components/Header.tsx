export default function Header() {
  return (
    <header style={{
      background: 'var(--char)',
      color: 'var(--cream)',
      padding: '0 1.5rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: '60px',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      borderBottom: '2px solid var(--terra)'
    }}>
      <div style={{
        fontFamily: 'var(--font-playfair)',
        fontSize: '1.4rem',
        fontWeight: 900,
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem'
      }}>
        🍞 Baker Hub <span style={{ color: 'var(--gold)', fontStyle: 'italic', fontSize: '0.85rem', fontWeight: 400 }}>beta</span>
      </div>
    </header>
  );
}