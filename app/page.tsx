'use client';
import Header from './components/Header';

export default function Home() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      <Header />
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem 1.25rem' }}>
        <div style={{ textAlign: 'center', padding: '2rem 0' }}>
          <h1 style={{ 
            fontFamily: 'var(--font-playfair)', 
            fontSize: '3rem', 
            fontWeight: 900,
            marginBottom: '0.75rem'
          }}>
            Your dough, <em style={{ color: 'var(--terra)', fontStyle: 'italic' }}>perfectly planned.</em>
          </h1>
          <p style={{ color: 'var(--smoke)', fontSize: '1rem', fontWeight: 300 }}>
            Tell us what you want to bake and when — we handle the science.
          </p>
        </div>
      </div>
    </div>
  );
}