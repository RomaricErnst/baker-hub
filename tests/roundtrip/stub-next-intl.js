// next-intl stub for the headless round-trip harness.
// Locale is English so the historical selectors ("Room temp", "Fridge", "Nights")
// keep their meaning; t() resolves real keys from messages/en.json so copy is
// the shipped copy, not key names.
import en from '../../messages/en.json';

function lookup(path) {
  return path.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), en);
}
function fmt(s, v) {
  if (typeof s !== 'string') return s;
  return v ? s.replace(/\{(\w+)\}/g, (_, k) => (k in v ? String(v[k]) : `{${k}}`)) : s;
}
export function useTranslations(ns) {
  const t = (k, v) => {
    const full = ns ? `${ns}.${k}` : k;
    const r = lookup(full);
    return r === undefined ? full : fmt(r, v);
  };
  t.rich = (k, v) => t(k, v);
  t.raw = (k) => lookup(ns ? `${ns}.${k}` : k);
  t.has = (k) => lookup(ns ? `${ns}.${k}` : k) !== undefined;
  return t;
}
export function useLocale() { return 'en'; }
export function useFormatter() {
  return { dateTime: (d, o) => new Intl.DateTimeFormat('en', o).format(d), number: (n, o) => new Intl.NumberFormat('en', o).format(n) };
}
export function NextIntlClientProvider({ children }) { return children; }

