'use client';
// Bake journal kept on this device: list rows for the "My bakes" menu page and
// the entry sheet (rating, note, photos, resume, bake again, delete).
// Same sheet shape as SessionViewer, without the account calls.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocale, useTranslations } from 'next-intl';
import { ALL_STYLES } from '@/app/data';
import { displayTemp, displayWeight, formatBakeDateTime, type UnitSystem } from '@/app/utils/units';
import {
  JOURNAL_NOTE_LIMIT, JOURNAL_PHOTO_LIMIT, deleteJournalEntry, journalBakeInProgress, updateJournalEntry,
  type JournalEntry,
} from '@/app/lib/localJournal';
import { addJournalPhoto, deleteJournalPhotos, readJournalPhotos } from '@/app/lib/journalPhotos';

export function journalTitle(entry: JournalEntry, locale: string): string {
  const name = entry.bakeName.trim();
  if (name) return name;
  const style = (ALL_STYLES as Record<string, { name: string; nameFr?: string }>)[entry.styleKey ?? ''];
  if (style) return locale === 'fr' ? style.nameFr ?? style.name : style.name;
  return locale === 'fr' ? 'Fournée' : 'Bake';
}

function journalFacts(entry: JournalEntry, locale: string, units: UnitSystem, t: ReturnType<typeof useTranslations>): string {
  return [
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

type Status = 'noteSaved' | 'photoFailed' | 'storageFailed' | 'saveToAccountFailed' | null;

/** Render with key={entry.id}: the sheet keeps its own copy of the entry while open. */
export function JournalEntrySheet({ entry: initial, units, signedIn, onClose, onChange, onResume, onRebake, onSaveToAccount }: {
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
}) {
  const t = useTranslations('journal');
  const locale = useLocale();
  const [entry, setEntry] = useState<JournalEntry | null>(initial);
  const [note, setNote] = useState(initial?.note ?? '');
  const [photos, setPhotos] = useState<Array<{ id: string; url: string; blob: Blob }>>([]);
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
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

  function remove() {
    const removed = deleteJournalEntry(current.id);
    if (!removed) { setStatus('storageFailed'); return; }
    void deleteJournalPhotos(removed.photoIds);
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

  const sectionLabel: React.CSSProperties = { fontSize: 11, color: 'var(--smoke)', textTransform: 'uppercase', letterSpacing: '.08em', margin: '0 0 10px' };
  const secondary: React.CSSProperties = { width: '100%', minHeight: 44, padding: '10px 14px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--cream)', color: 'var(--char)', font: 'inherit', cursor: 'pointer' };
  const divider = { height: 1, background: 'var(--border)', margin: '16px 20px 0' };
  const inProgress = journalBakeInProgress(current);
  // Before the bake there is nothing to rate: the entry shows the plan instead.
  const beforeBake = !rateNow && current.eatTime != null && current.eatTime > Date.now() && current.rating == null && !current.note && current.photoIds.length === 0;
  const startAt = typeof current.session?.startTime === 'number' ? current.session.startTime : null;
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <strong style={{ fontSize: 14 }}>{t('myBakes')}</strong>
          <button type="button" onClick={onClose} style={{ ...secondary, width: 'auto' }}>{t('close')}</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          <div style={{ padding: '16px 20px 0' }}>
            <p style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700 }}>{journalTitle(current, locale)}</p>
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
              style={{ width: '100%', boxSizing: 'border-box', padding: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--cream)', color: 'var(--char)', font: 'inherit', fontSize: 16, resize: 'vertical' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
              <button type="button" disabled={!noteChanged} onClick={() => commit({ note }, 'noteSaved')}
                style={{ ...secondary, width: 'auto', opacity: noteChanged ? 1 : 0.5, cursor: noteChanged ? 'pointer' : 'default' }}>{t('saveNote')}</button>
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
          {confirmDelete ? (
            <div role="group" aria-label={t('deleteQuestion')}>
              <p style={{ margin: '0 0 8px', fontSize: 14 }}>{t('deleteQuestion')}</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={remove} style={{ ...secondary, flex: 1, background: 'var(--char)', color: 'white', borderColor: 'var(--char)' }}>{t('deleteConfirm')}</button>
                <button type="button" autoFocus onClick={() => setConfirmDelete(false)} style={{ ...secondary, flex: 1 }}>{t('deleteKeep')}</button>
              </div>
            </div>
          ) : <>
            {inProgress && <button type="button" onClick={() => { onResume(current); onClose(); }} style={{ ...secondary, background: 'var(--terra)', color: 'white', borderColor: 'var(--terra)', fontWeight: 600 }}>{t('resume')}</button>}
            <button type="button" onClick={() => { onRebake(current); onClose(); }} style={inProgress ? secondary : { ...secondary, background: 'var(--terra)', color: 'white', borderColor: 'var(--terra)', fontWeight: 600 }}>{t('rebake', { date: nextWeekLabel }).replace(/ \(\)$/, '')}</button>
            {signedIn && onSaveToAccount && !current.accountEventId && <>
              <button type="button" disabled={savingAccount} aria-busy={savingAccount} onClick={() => void saveToAccount()} style={secondary}>{savingAccount ? t('savingToAccount') : t('saveToAccount')}</button>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--smoke)' }}>{t('saveToAccountNote')}</p>
            </>}
            <button type="button" onClick={() => setConfirmDelete(true)} style={{ minHeight: 44, border: 'none', background: 'transparent', color: 'var(--ash)', font: 'inherit', fontSize: 13, textDecoration: 'underline', cursor: 'pointer' }}>{t('delete')}</button>
          </>}
        </div>
      </div>
    </>,
    document.body,
  );
}
