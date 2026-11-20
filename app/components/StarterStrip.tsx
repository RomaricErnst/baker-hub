'use client';
// Starter readiness strip (20 Nov 2026 chart review, owner's decision): in Your plan, between the pre-mix
// feed and Start Dough, the run-up day's feeds, the window in which the starter is ready (the solver's own
// green band around the peak the card shows, rounded inward to whole hours), Start Dough inside it and the
// busy times shaded and named. It replaces the multi-day fermentation chart: no curves, no legend, no
// dragging; token colours only. A fridge spell is one line of text under it, not drawn.
import React, { useEffect, useId, useRef, useState } from 'react';
import { formatPlanClock } from '../utils/units';
import { peakAround, readyBand, readyHours, readyLabel } from '../utils/peakTime';
import { preMixRiseH } from '../utils/starterPeak';

type Kind = 'last_fed' | 'refresh' | 'intermediate_refresh' | 'pre_mix' | 'fridge_in' | 'fridge_out' | 'known_peak';
export interface StripEvent { kind: Kind | string; time: Date; bellPeakTime?: Date; historicalStorage?: boolean }
export interface StripBlock { label?: string; from: Date; to: Date }

const HOUR = 3600000;
const FEEDS = ['refresh', 'intermediate_refresh', 'pre_mix'];
/** Short names under the strip; the plan's rows carry the full ones. */
const KIND_NAME: Record<string, [string, string]> = {
  refresh: ['rafraîchi', 'refresh feed'],
  intermediate_refresh: ['rafraîchi', 'intermediate feed'],
  pre_mix: ['avant pétrissage', 'pre-mix feed'],
};

export interface StarterStripModel {
  peakMs: number; mixMs: number; band: { from: number; to: number }; hours: { from: Date; to: Date } | null;
  feeds: { kind: string; at: number; peak?: number }[];
  fridge: { from: number; to: number } | null;
}

/** The strip's numbers, from the plan's starter events: null when the plan has no pre-mix feed with a peak
 * before the mix (a known peak, or a starter used without a planned feed). Exported for tests. */
export function starterStripModel(events: readonly StripEvent[], mixAt: Date): StarterStripModel | null {
  const mixMs = +mixAt;
  const feeds = events.filter(e => [...FEEDS, 'last_fed'].includes(e.kind)).sort((a, b) => +a.time - +b.time);
  const preMix = [...feeds].reverse().find(e => e.kind === 'pre_mix' && +e.time <= mixMs && e.bellPeakTime);
  if (!preMix?.bellPeakTime) return null;
  const before = feeds.filter(e => +e.time < +preMix.time).at(-1);
  const peakMs = +preMix.bellPeakTime;
  // The same rise and band the picker validates the shown plan with (mixNearPeak on preMixRiseH).
  const band = readyBand(peakMs, preMixRiseH(+preMix.time, peakMs, before ? +before.time : null));
  const shown = feeds.filter(e => FEEDS.includes(e.kind) && !e.historicalStorage && +e.time <= +preMix.time && +e.time >= mixMs - 24 * HOUR)
    // Named as the plan's rows name them: the first planned feed is never "intermediate" (starterFeedLabelFor).
    .map(e => ({ kind: e.kind === 'intermediate_refresh' && !feeds.some(f => (f.kind === 'refresh' || f.kind === 'intermediate_refresh') && +f.time < +e.time) ? 'refresh' : e.kind,
      at: +e.time, peak: e.bellPeakTime ? +e.bellPeakTime : undefined }));
  const first = shown[0]?.at ?? +preMix.time;
  const fridgeIn = events.find(e => e.kind === 'fridge_in' && +e.time >= first && +e.time < mixMs && !e.historicalStorage);
  const fridgeOut = fridgeIn ? events.find(e => e.kind === 'fridge_out' && +e.time > +fridgeIn.time && +e.time <= mixMs) : undefined;
  return { peakMs, mixMs, band, hours: readyHours(band), feeds: shown,
    fridge: fridgeIn && fridgeOut ? { from: +fridgeIn.time, to: +fridgeOut.time } : null };
}

/** The presets' internal labels ("Friday night", "Work · Fri, Nov 20") read as one plain word; a baker's own label is kept. */
export function busyName(label: string | undefined, fr: boolean): string {
  const text = (label ?? '').trim();
  if (text.endsWith(' night')) return fr ? 'nuit' : 'night';
  if (text.startsWith('Work · ')) return fr ? 'travail' : 'work';
  return text;
}
const weekday = (ms: number, fr: boolean) => new Date(ms).toLocaleDateString(fr ? 'fr-FR' : 'en-GB', { weekday: 'short' });
const textW = (text: string, size: number) => text.length * size * 0.52; // Figtree's average advance, a little generous

export default function StarterStrip({ events, mixAt, blocks = [], fr, startLabel }: {
  events: readonly StripEvent[]; mixAt: Date; blocks?: readonly StripBlock[]; fr: boolean; startLabel?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(326);
  const gid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(entries => { const w = Math.round(entries[0]?.contentRect.width ?? 0); if (w > 0) setWidth(w); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const model = starterStripModel(events, mixAt);
  if (!model) return null;
  const locale = fr ? 'fr' : 'en';
  const clock = (ms: number) => formatPlanClock(new Date(ms), locale);
  const W = width, pad = 4;
  const t0 = (model.feeds[0]?.at ?? model.mixMs) - 0.4 * HOUR;
  const t1 = Math.max(model.mixMs, model.band.to) + 0.4 * HOUR;
  const x = (ms: number) => pad + ((ms - t0) / (t1 - t0)) * (W - 2 * pad);
  const span = model.feeds.length && new Date(model.feeds[0].at).toDateString() !== new Date(model.mixMs).toDateString();
  const ready = model.hours ? readyLabel(model.hours, fr) : null;
  const startName = startLabel ?? (fr ? 'Pétrir la pâte' : 'Start Dough');

  // Bars: each feed rises to its peak (or to the next feed), then falls until the next feed; the pre-mix
  // feed rises into the ready window. A fridge spell ends the bar (said in text below).
  const bars: { from: number; to: number; rise: boolean }[] = [];
  model.feeds.forEach((feed, i) => {
    const isLast = i === model.feeds.length - 1;
    let end = isLast ? model.band.from : model.feeds[i + 1].at;
    if (model.fridge && model.fridge.from > feed.at && model.fridge.from < end) end = model.fridge.from;
    if (end <= feed.at) return;
    const peak = !isLast && feed.peak && feed.peak > feed.at && feed.peak < end ? feed.peak : null;
    bars.push({ from: feed.at, to: peak ?? end, rise: true });
    if (peak) bars.push({ from: peak, to: end, rise: false });
  });
  const busy = blocks.filter(b => +b.to > t0 && +b.from < t1).map(b => ({ label: busyName(b.label, fr), from: Math.max(+b.from, t0), to: Math.min(+b.to, t1) }));

  // Labels under the axis: Start Dough always; a feed's label only where it does not collide.
  type Label = { x: number; w: number; time: string; name: string; strong?: boolean };
  const place = (cx: number, w: number) => Math.min(W - pad - w / 2, Math.max(pad + w / 2, cx));
  const mk = (cx: number, time: string, name: string, strong?: boolean): Label => {
    const w = Math.max(textW(time, 12), textW(name, 11));
    return { x: place(cx, w), w, time, name, strong };
  };
  const mixLabel = mk(x(model.mixMs), clock(model.mixMs), startName, true);
  const labels: Label[] = [mixLabel];
  for (const feed of [...model.feeds].reverse()) {
    const name = (KIND_NAME[feed.kind] ?? KIND_NAME.refresh)[fr ? 0 : 1];
    const l = mk(x(feed.at), (span ? weekday(feed.at, fr) + ' ' : '') + clock(feed.at), name);
    const next = labels[labels.length - 1];
    if (l.x + l.w / 2 + 6 <= next.x - next.w / 2) labels.push(l);
  }

  const feedText = model.feeds.map(f => `${(KIND_NAME[f.kind] ?? KIND_NAME.refresh)[fr ? 0 : 1]} ${weekday(f.at, fr)} ${clock(f.at)}`).join(', ');
  const busyNames = [...new Set(busy.map(b => b.label).filter(Boolean))];
  const peakText = peakAround(new Date(model.peakMs), fr);
  const alt = fr
    ? `Levain : ${ready ? ready + ', ' : ''}pic ${peakText}. ${startName} ${clock(model.mixMs)}.${feedText ? ' Rafraîchis : ' + feedText + '.' : ''}${busyNames.length ? ' Occupé : ' + busyNames.join(', ') + '.' : ''}`
    : `Starter: ${ready ? ready + ', ' : ''}peak ${peakText}. ${startName} ${clock(model.mixMs)}.${feedText ? ' Feeds: ' + feedText + '.' : ''}${busyNames.length ? ' Busy: ' + busyNames.join(', ') + '.' : ''}`;
  const readyX = (x(model.band.from) + x(model.band.to)) / 2;
  const readyW = ready ? textW(ready, 11.5) : 0;
  const mixX = x(model.mixMs);
  const H = 138, axisY = 96;

  return <div ref={ref} data-starter-strip data-peak-ms={model.peakMs} data-band-from={model.band.from} data-band-to={model.band.to} data-mix-ms={model.mixMs} style={{ margin: '4px 0 6px', maxWidth: '100%' }}>
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={alt} style={{ display: 'block', maxWidth: '100%', fontFamily: 'inherit', overflow: 'visible' }}>
      <defs>
        <linearGradient id={`${gid}r`} x1="0" x2="1"><stop offset="0" style={{ stopColor: 'var(--gold)', stopOpacity: 0.18 }} /><stop offset="1" style={{ stopColor: 'var(--gold)', stopOpacity: 0.7 }} /></linearGradient>
        <linearGradient id={`${gid}f`} x1="0" x2="1"><stop offset="0" style={{ stopColor: 'var(--gold)', stopOpacity: 0.7 }} /><stop offset="1" style={{ stopColor: 'var(--gold)', stopOpacity: 0.1 }} /></linearGradient>
      </defs>
      {busy.map((b, i) => {
        const bx = x(b.from), bw = x(b.to) - bx;
        return <g key={i} data-strip-busy>
          <rect x={bx} y={8} width={bw} height={axisY - 8} style={{ fill: 'var(--smoke)', fillOpacity: 0.07 }} />
          {b.label && bw >= textW(b.label, 10.5) + 8 && <text x={bx + 4} y={19} fontSize={10.5} style={{ fill: 'var(--smoke)' }}>{b.label}</text>}
        </g>;
      })}
      {bars.map((b, i) => <rect key={i} x={x(b.from)} y={40} width={Math.max(1, x(b.to) - x(b.from) - 2)} height={20} rx={5} fill={`url(#${gid}${b.rise ? 'r' : 'f'})`} />)}
      {model.feeds.map((f, i) => i < model.feeds.length - 1 && f.peak && bars.some(b => !b.rise && b.from === f.peak)
        ? <circle key={i} cx={x(f.peak)} cy={50} r={3} style={{ fill: 'var(--gold)' }} /> : null)}
      <rect data-strip-ready x={x(model.band.from)} y={36} width={x(model.band.to) - x(model.band.from)} height={28} rx={6} style={{ fill: 'var(--sage)', fillOpacity: 0.2, stroke: 'var(--sage)', strokeWidth: 1.2 }} />
      <line x1={mixX} x2={mixX} y1={36} y2={64} style={{ stroke: 'var(--sage-text)', strokeWidth: 1.5 }} />
      {ready && <text x={Math.min(W - pad - readyW / 2, Math.max(pad + readyW / 2, readyX))} y={31} fontSize={11.5} fontWeight={600} textAnchor="middle" style={{ fill: 'var(--sage-text)' }}>{ready}</text>}
      <line x1={pad} x2={W - pad} y1={axisY} y2={axisY} style={{ stroke: 'var(--border)' }} />
      {model.feeds.map((f, i) => <circle key={i} cx={x(f.at)} cy={axisY} r={6} style={{ fill: 'var(--gold)', stroke: 'var(--warm)', strokeWidth: 1.5 }} />)}
      <polygon points={`${mixX},${axisY - 9} ${mixX + 9},${axisY} ${mixX},${axisY + 9} ${mixX - 9},${axisY}`} style={{ fill: 'var(--sage-text)', stroke: 'var(--warm)', strokeWidth: 1.5 }} />
      {labels.map((l, i) => <g key={i}>
        <text x={l.x} y={122} fontSize={12} fontWeight={l.strong ? 600 : 400} textAnchor="middle" style={{ fill: l.strong ? 'var(--char)' : 'var(--ash)' }}>{l.time}</text>
        <text x={l.x} y={135} fontSize={11} textAnchor="middle" style={{ fill: 'var(--smoke)' }}>{l.name}</text>
      </g>)}
    </svg>
    {model.fridge && <p data-strip-fridge style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--smoke)' }}>
      {fr ? `Au réfrigérateur jusqu’à ${weekday(model.fridge.to, fr)} ${clock(model.fridge.to)}` : `In the fridge until ${weekday(model.fridge.to, fr)} ${clock(model.fridge.to)}`}
    </p>}
  </div>;
}
