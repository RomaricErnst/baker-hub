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
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}>
        <div style={{
          fontFamily: 'var(--font-playfair)',
          fontSize: '1.4rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          lineHeight: 1.2,
        }}>
          🍞 Baker Hub
        </div>
        <div style={{
          fontFamily: 'var(--font-dm-sans)',
          fontStyle: 'italic',
          fontSize: '.68rem',
          color: 'var(--gold)',
          lineHeight: 1.2,
        }}>
          artisan dough planner
        </div>
      </div>
    </header>
  );
}
