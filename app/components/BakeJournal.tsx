'use client';
// Bake journal kept on this device: list rows for the "My bakes" menu page and
// the entry sheet (rating, note, photos, resume, bake again, delete).
// Same sheet shape as SessionViewer, without the account calls.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SHEET_CLOSE, SHEET_TITLE } from '@/app/lib/navButtons';
import { useLocale, useTranslations } from 'next-intl';
import { ALL_STYLES } from '@/app/data';
import { bakeTitleName } from '@/app/utils/bakeTitle';
import { displayTemp, displayWeight, formatBakeDateTime, type UnitSystem } from '@/app/utils/units';
import {
  JOURNAL_NOTE_LIMIT, JOURNAL_PHOTO_LIMIT, journalBakeInProgress, updateJournalEntry,
  type JournalEntry,
} from '@/app/lib/localJournal';
import { addJournalPhoto, deleteJournalPhotos, readJournalPhotos } from '@/app/lib/journalPhotos';
import { removeJournalBake } from '@/app/lib/journalRemoval';

/** The bake's own name: the one the baker gave, else the Recipe's automatic one ("Pizza night", "Baguettes"),
 *  so the rating sheet, the menu and home name a bake as its Recipe does (20 Nov 2026 round 6). */
export function journalTitle(entry: JournalEntry, locale: string): string {
  const name = entry.bakeName.trim();
  if (name) return name;
  if (!entry.bakeType) return locale === 'fr' ? 'Fournée' : 'Bake';
  return bakeTitleName(entry.bakeType, entry.styleKey, entry.numItems, entry.eatTime != null ? new Date(entry.eatTime).getHours() : undefined, locale === 'fr', journalStyleName(entry, locale) ?? '');
}

/** The style, as the subtitle when the title does not already say it. */
export function journalStyleName(entry: Pick<JournalEntry, 'styleKey'>, locale: string): string | null {
  const style = (ALL_STYLES as Record<string, { name: string; nameFr?: string }>)[entry.styleKey ?? ''];
  return style ? (locale === 'fr' ? style.nameFr ?? style.name : style.name) : null;
}

function journalFacts(entry: JournalEntry, locale: string, units: UnitSystem, t: ReturnType<typeof useTranslations>): string {
  const style = journalStyleName(entry, locale);
  return [
    style && style !== journalTitle(entry, locale) ? style : null,
    entry.numItems && entry.itemWeight ? `${entry.numItems} × ${displayWeight(entry.itemWeight, units, locale)}` : null,
    entry.kitchenTemp != null ? t('kitchen', { temp: displayTemp(entry.kitchenTemp, units) }) : null,
  ].filter(Boolean).join(' · ');
}

export function JournalCard({ entry, units, current, onOpen }: {
  entry: JournalEntry; units: UnitSystem; current: boolean; onOpen: (entry: JournalEntry) => void;
}) {
  const t = useTranslations('journal');
  const locale = useLocale();
  const extras = [
    current ? t('currentBake') : null,
    entry.rating ? t('rated', { rating: entry.rating }) : null,
    entry.note ? t('hasNote') : null,
    entry.photoIds.length ? t('photoCount', { count: entry.photoIds.length }) : null,
    entry.accountEventId ? t('savedToAccount') : null,
  ].filter(Boolean);
  return (
    <button type="button" data-journal-entry={entry.id} onClick={() => onOpen(entry)} style={{
      display: 'block', width: '100%', textAlign: 'left', minHeight: 44, padding: '10px 14px', marginTop: 8,
      border: '1px solid var(--border)', borderRadius: 12, background: 'white', color: 'var(--char)',
      font: 'inherit', cursor: 'pointer', boxSizing: 'border-box',
    }}>
      <span style={{ display: 'block', fontWeight: 600 }}>{journalTitle(entry, locale)}</span>
      <span style={{ display: 'block', fontSize: 13, color: 'var(--ash)' }}>
        {[journalFacts(entry, locale, units, t), entry.eatTime != null ? t('bakeAt', { date: formatBakeDateTime(new Date(entry.eatTime), locale) }) : null].filter(Boolean).join(' · ')}
      </span>
      {extras.length > 0 && <span style={{ display: 'block', fontSize: 12, color: 'var(--smoke)', marginTop: 2 }}>{extras.join(' · ')}</span>}
    </button>
  );
}

/** "Removed · Undo" where a removed bake's row was, until the next navigation (round 18, H3). */
export function RemovedUndo({ entry, onUndo }: { entry: JournalEntry; onUndo: () => void }) {
  const t = useTranslations('journal');
  const locale = useLocale();
  return (
    <div role="status" data-journal-removed={entry.id} style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 48, padding: '0 4px 0 14px', border: '1px dashed var(--border)', borderRadius: 12, color: 'var(--smoke)', fontSize: 15 }}>
      <span>{t('removed')} ·</span>
      <button type="button" data-journal-undo onClick={onUndo} aria-label={t('undoLabel', { name: journalTitle(entry, locale) })}
        style={{ minHeight: 44, minWidth: 44, padding: '0 10px', border: 'none', background: 'transparent', color: 'var(--char)', font: 'inherit', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer' }}>{t('undo')}</button>
    </div>
  );
}

type Status = 'noteSaved' | 'photoFailed' | 'storageFailed' | 'saveToAccountFailed' | null;

/** Render with key={entry.id}: the sheet keeps its own copy of the entry while open. */
export function JournalEntrySheet({ entry: initial, units, signedIn, onClose, onChange, onResume, onRebake, onSaveToAccount, removeAt }: {
  entry: JournalEntry | null;
  units: UnitSystem;
  signedIn: boolean;
  onClose: () => void;
  /** Called with the stored entry after each change, or null after delete. */
  onChange: (id: string, entry: JournalEntry | null) => void;
  onResume: (entry: JournalEntry) => void;
  onRebake: (entry: JournalEntry) => void;
  /** Present only for signed-in bakers; resolves to the new bake_events id. */
  onSaveToAccount?: (entry: JournalEntry, photos: Blob[]) => Promise<string | null>;
  /** Where the app will be right after a removal (removeJournalBake's `at`). */
  removeAt?: Record<string, string>;
}) {
  const t = useTranslations('journal');
  const locale = useLocale();
  const [entry, setEntry] = useState<JournalEntry | null>(initial);
  const [note, setNote] = useState(initial?.note ?? '');
  const [photos, setPhotos] = useState<Array<{ id: string; url: string; blob: Blob }>>([]);
  const [adding, setAdding] = useState(false);
  const [rateNow, setRateNow] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const urlsRef = useRef<string[]>([]);

  const photoKey = entry?.photoIds.join('|') ?? '';
  useEffect(() => {
    let cancelled = false;
    const ids = photoKey ? photoKey.split('|') : [];
    readJournalPhotos(ids).then(rows => {
      if (cancelled) return;
      let next: Array<{ id: string; url: string; blob: Blob }> = [];
      try { next = rows.map(row => ({ id: row.id, blob: row.blob, url: URL.createObjectURL(row.blob) })); } catch {}
      urlsRef.current.forEach(url => { try { URL.revokeObjectURL(url); } catch {} });
      urlsRef.current = next.map(photo => photo.url);
      setPhotos(next);
    });
    return () => { cancelled = true; };
  }, [photoKey]);
  useEffect(() => () => { urlsRef.current.forEach(url => { try { URL.revokeObjectURL(url); } catch {} }); }, []);

  useEffect(() => {
    if (!entry) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [entry, onClose]);

  if (!entry || typeof document === 'undefined') return null;
  const current = entry;

  function commit(patch: Parameters<typeof updateJournalEntry>[1], success?: Status): boolean {
    const next = updateJournalEntry(current.id, patch);
    if (!next) { setStatus('storageFailed'); return false; }
    setEntry(next); onChange(next.id, next); setStatus(success ?? null);
    return true;
  }

  async function addPhotos(files: File[]) {
    setAdding(true); setStatus(null);
    let ids = [...current.photoIds];
    for (const file of files.slice(0, Math.max(0, JOURNAL_PHOTO_LIMIT - ids.length))) {
      const id = await addJournalPhoto(current.id, file);
      if (!id) { setStatus('photoFailed'); continue; }
      ids = [...ids, id];
      if (!commit({ photoIds: ids })) { void deleteJournalPhotos([id]); ids = ids.filter(value => value !== id); break; }
    }
    setAdding(false);
  }

  function removePhoto(id: string) {
    if (commit({ photoIds: current.photoIds.filter(value => value !== id) })) void deleteJournalPhotos([id]);
  }

  // Immediate, with Undo where the row was (round 18, H3): no question first; photos go once Undo is gone.
  function remove() {
    if (!removeJournalBake(current.id, removeAt)) { setStatus('storageFailed'); return; }
    onChange(current.id, null);
    onClose();
  }

  async function saveToAccount() {
    if (!onSaveToAccount || savingAccount) return;
    setSavingAccount(true); setStatus(null);
    const id = await onSaveToAccount({ ...current, note }, photos.map(photo => photo.blob)).catch(() => null);
    setSavingAccount(false);
    if (!id) { setStatus('saveToAccountFailed'); return; }
    commit({ accountEventId: id });
  }

  // Sentence-case labels, as everywhere else (16 Nov 2026 design review).
  const sectionLabel: React.CSSProperties = { fontSize: 15, fontWeight: 600, color: 'var(--char)', margin: '0 0 10px' };
  const secondary: React.CSSProperties = { width: '100%', minHeight: 44, padding: '10px 14px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--cream)', color: 'var(--char)', font: 'inherit', cursor: 'pointer' };
  const divider = { height: 1, background: 'var(--border)', margin: '16px 20px 0' };
  const inProgress = journalBakeInProgress(current);
  const beforeOven = inProgress && (current.eatTime == null || current.eatTime > Date.now());
  // Before the bake there is nothing to rate: the entry shows the plan instead.
  const beforeBake = !rateNow && current.eatTime != null && current.eatTime > Date.now() && current.rating == null && !current.note && current.photoIds.length === 0;
  // The first thing to do: a poolish or biga starts before the dough (17 Nov retention review).
  const prefLead = current.session?.prefermentType && current.session.prefermentType !== 'none' && current.session.prefermentType !== 'levain' && typeof current.session.prefOffsetH === 'number' ? current.session.prefOffsetH * 3600000 : 0;
  const startAt = typeof current.session?.startTime === 'number' ? current.session.startTime - prefLead : null;
  const nextWeek = current.eatTime != null ? new Date(current.eatTime + 7 * 86400000) : null;
  const nextWeekLabel = nextWeek ? nextWeek.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : '';
  const noteChanged = note !== current.note;

  return createPortal(
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 299 }} />
      <div role="dialog" aria-modal="true" aria-label={t('sheetLabel')} style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, maxHeight: '92dvh', display: 'flex', flexDirection: 'column',
        background: 'var(--warm)', color: 'var(--char)', borderRadius: '20px 20px 0 0', zIndex: 300,
        maxWidth: 680, margin: '0 auto', fontFamily: 'var(--font-ui)', fontSize: 15, lineHeight: 1.5,
      }}>
        {/* The same header as the other sheets: a 17 px title and the cream ✕ (SHEET_TITLE / SHEET_CLOSE). */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 16px 8px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {/* One bake's sheet is titled with that bake, not "My bakes" (20 Nov 2026 retention round 5, Maya). */}
          <strong style={SHEET_TITLE}>{journalTitle(current, locale)}</strong>
          <button type="button" onClick={onClose} aria-label={t('close')} style={SHEET_CLOSE}><span aria-hidden="true">✕</span></button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          <div style={{ padding: '16px 20px 0' }}>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--ash)' }}>{journalFacts(current, locale, units, t)}</p>
            {current.eatTime != null && !beforeBake && <p style={{ margin: 0, fontSize: 13, color: 'var(--ash)' }}>{t('bakeAt', { date: formatBakeDateTime(new Date(current.eatTime), locale) })}</p>}
            <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--smoke)' }}>{current.accountEventId ? t('savedToAccount') : t('deviceOnly')}</p>
          </div>

          {beforeBake ? <>
          <div style={divider} />
          <div data-journal-plan style={{ padding: '16px 20px 0' }}>
            {startAt != null && <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600 }}>{t('startAt', { date: formatBakeDateTime(new Date(startAt), locale) })}</p>}
            {current.eatTime != null && <p style={{ margin: '0 0 8px', fontSize: 15 }}>{t('bakeAt', { date: formatBakeDateTime(new Date(current.eatTime), locale) })}</p>}
            <p style={{ margin: 0, fontSize: 13, color: 'var(--ash)' }}>{t('beforeBakeNote')}</p>
            <button type="button" data-rate-now onClick={() => setRateNow(true)} style={{ minHeight: 44, padding: 0, border: 'none', background: 'transparent', color: 'var(--terra)', font: 'inherit', fontSize: 14, textDecoration: 'underline', cursor: 'pointer' }}>{t('rateNow')}</button>
          </div>
          </> : <>
          <div style={divider} />
          <fieldset style={{ border: 'none', margin: 0, padding: '16px 20px 0' }}>
            <legend style={{ ...sectionLabel, padding: 0, float: 'left', width: '100%' }}>{t('ratingQuestion')}</legend>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', clear: 'both' }}>
              {([1, 2, 3, 4, 5] as const).map(value => {
                const on = current.rating === value;
                return (
                  <button key={value} type="button" aria-pressed={on} aria-label={t('ratingOption', { rating: value })}
                    onClick={() => commit({ rating: value })}
                    style={{ minWidth: 44, minHeight: 44, borderRadius: 20, border: `1px solid ${on ? 'var(--terra)' : 'var(--border)'}`, background: on ? 'var(--terra)' : 'white', color: on ? 'white' : 'var(--char)', font: 'inherit', fontWeight: 600, cursor: 'pointer', fontVariantNumeric: 'tabular-nums' }}>
                    {value}
                  </button>
                );
              })}
              {current.rating != null && <button type="button" onClick={() => commit({ rating: null })} style={{ minHeight: 44, padding: '0 8px', border: 'none', background: 'transparent', color: 'var(--ash)', font: 'inherit', fontSize: 13, textDecoration: 'underline', cursor: 'pointer' }}>{t('clearRating')}</button>}
            </div>
          </fieldset>

          <div style={divider} />
          <div style={{ padding: '16px 20px 0' }}>
            <label htmlFor={`journal-note-${current.id}`} style={{ ...sectionLabel, display: 'block' }}>{t('noteLabel')}</label>
            <textarea id={`journal-note-${current.id}`} value={note} maxLength={JOURNAL_NOTE_LIMIT} rows={3}
              onChange={e => { setNote(e.target.value); if (status === 'noteSaved') setStatus(null); }}
              placeholder={t('notePlaceholder')}
              style={{ width: '100%', boxSizing: 'border-box', padding: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--paper)', color: 'var(--char)', font: 'inherit', fontSize: 16, resize: 'vertical' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
              <button type="button" disabled={!noteChanged} onClick={() => commit({ note }, 'noteSaved')}
                style={{ ...secondary, width: 'auto', ...(noteChanged ? { background: 'var(--warm)', borderColor: 'var(--terra)', color: 'var(--terra)', fontWeight: 600 } : { opacity: 0.5, cursor: 'default' }) }}>{t('saveNote')}</button>
              {status === 'noteSaved' && <span role="status" style={{ fontSize: 13, color: 'var(--sage)' }}>{t('noteSaved')}</span>}
            </div>
          </div>

          <div style={divider} />
          <div style={{ padding: '16px 20px 0' }}>
            <div style={sectionLabel}>{t('photosLabel')}</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {photos.map(photo => (
                <div key={photo.id} style={{ position: 'relative', width: 88, height: 88 }}>
                  <img src={photo.url} alt="" style={{ width: 88, height: 88, objectFit: 'cover', borderRadius: 12, display: 'block' }} />
                  <button type="button" onClick={() => removePhoto(photo.id)} aria-label={t('removePhoto')}
                    style={{ position: 'absolute', top: -10, right: -10, width: 44, height: 44, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}>
                    <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: '50%', background: 'var(--char)', color: 'white', fontSize: 14, lineHeight: 1 }}>×</span>
                  </button>
                </div>
              ))}
              {current.photoIds.length < JOURNAL_PHOTO_LIMIT && (
                <label style={{ position: 'relative', width: 88, height: 88, borderRadius: 12, border: '1.5px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontSize: 12, color: 'var(--ash)', cursor: 'pointer', padding: 6, boxSizing: 'border-box' }}>
                  {adding ? t('addingPhoto') : t('addPhoto')}
                  <input type="file" accept="image/*" multiple disabled={adding} style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
                    onChange={e => { const files = Array.from(e.target.files ?? []); e.target.value = ''; if (files.length) void addPhotos(files); }} />
                </label>
              )}
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--smoke)' }}>{t('photoLimit', { count: current.photoIds.length })}</p>
          </div>
          </>}

          {(status === 'photoFailed' || status === 'storageFailed' || status === 'saveToAccountFailed') && (
            <p role="status" style={{ margin: '12px 20px 0', fontSize: 13, color: 'var(--ash)' }}>{t(status)}</p>
          )}
          <div style={{ height: 16 }} />
        </div>

        <div style={{ borderTop: '1px solid var(--border)', padding: '12px 20px', paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))', display: 'grid', gap: 8, flexShrink: 0 }}>
          <>
            {/* Right after the bake, opening it again is not the next thing to do: Bake again leads (18 Nov 2026
                retention round 4). Delete is always there: it has an Undo (round 18). */}
            {inProgress && <button type="button" onClick={() => { onResume(current); onClose(); }} style={beforeOven ? { ...secondary, background: 'var(--terra)', color: 'white', borderColor: 'var(--terra)', fontWeight: 600 } : secondary}>{t('resume')}</button>}
            <button type="button" onClick={() => { onRebake(current); onClose(); }} style={beforeOven ? secondary : { ...secondary, background: 'var(--terra)', color: 'white', borderColor: 'var(--terra)', fontWeight: 600 }}>{t('rebake', { date: nextWeekLabel }).replace(/ \(\)$/, '')} →</button>
            {signedIn && onSaveToAccount && !current.accountEventId && <>
              <button type="button" disabled={savingAccount} aria-busy={savingAccount} onClick={() => void saveToAccount()} style={secondary}>{savingAccount ? t('savingToAccount') : t('saveToAccount')}</button>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--smoke)' }}>{t('saveToAccountNote')}</p>
            </>}
            <button type="button" data-journal-delete onClick={remove} style={{ minHeight: 44, border: 'none', background: 'transparent', color: 'var(--ash)', font: 'inherit', fontSize: 13, textDecoration: 'underline', cursor: 'pointer' }}>{t('delete')}</button>
          </>
        </div>
      </div>
    </>,
    document.body,
  );
}
