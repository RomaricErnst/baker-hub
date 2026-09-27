interface Step<K extends string> { key: K; label: string; locked?: boolean; done?: boolean; }
interface Props<K extends string> { label: string; steps: Step<K>[]; active: K; onChange: (key: K) => void; onReveal?: () => void; }
/** Shared, compact phase navigation for pizza and bread fillings. */
export default function CompanionSteps<K extends string>({label, steps, active, onChange, onReveal}: Props<K>) {
  return <nav className="bh-companion-steps" aria-label={label}>
    {steps.map(step => <button key={step.key} type="button" disabled={step.locked}
      aria-current={active === step.key ? 'step' : undefined} data-done={step.done || undefined}
      onClick={() => onChange(step.key)}>
      <span className="bh-companion-dot" aria-hidden="true" />
      <span>{step.label}</span>
    </button>)}
    {onReveal && <button type="button" className="bh-nav-reveal" aria-label="Navigation" onClick={onReveal}>↑</button>}
  </nav>;
}
