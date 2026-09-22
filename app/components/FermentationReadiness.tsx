'use client';

import { useId } from 'react';
import { assessTimingWindow } from '../utils/fermentationAssessment';

interface FermentationReadinessProps {
  isFr: boolean;
  mixTime: Date;
  bakeTime: Date;
  windowFrom: Date | null;
  windowTo: Date | null;
  isSourdough: boolean;
  prefermentType: string;
  starterPeak: Date | null;
  starterState: 'green' | 'yellow' | 'red' | null;
  blocked: boolean;
  overdue: boolean;
  busy: boolean;
  conflictDescription?: string;
  repairLabel?: string;
  onApplyRepair?: () => void;
  kitchenTemp: number;
  fridgeTemp: number;
  onEditMix: () => void;
  onEditBake: () => void;
  onReviewAvailability?: () => void;
  canEdit: boolean;
  unavailableReason?: 'started' | 'unsupported';
}

/** A schedule decision aid, deliberately distinct from measured dough maturity. */
export default function FermentationReadiness({
  isFr, mixTime, bakeTime, windowFrom, windowTo, isSourdough,
  prefermentType, starterPeak, starterState, blocked, overdue, busy,
  kitchenTemp, fridgeTemp, onEditMix, onEditBake, onReviewAvailability, canEdit, unavailableReason,
  conflictDescription, repairLabel, onApplyRepair,
}: FermentationReadinessProps) {
  const titleId = useId();
  const t = (fr: string, en: string) => isFr ? fr : en;
  const validDate = (date: Date | null): date is Date =>
    date instanceof Date && Number.isFinite(date.getTime());
  const format = (date: Date, withDate = true) => new Intl.DateTimeFormat(isFr ? 'fr-FR' : 'en-GB', {
    ...(withDate ? { weekday: 'short' as const, day: 'numeric' as const, month: 'short' as const } : {}),
    hour: '2-digit', minute: '2-digit',
  }).format(date);
  const assessment = assessTimingWindow({mixTime, bakeTime, windowFrom, windowTo});
  const status = blocked || overdue || unavailableReason ? 'unavailable' : assessment.status;
  const hasWindow = status !== 'unavailable' && validDate(windowFrom) && validDate(windowTo);
  const inWindow = status === 'within';
  const clearWindow = inWindow && !busy;
  const outside = status === 'early' || status === 'late';
  const marker = status === 'early' ? 8 : status === 'late' ? 92 : 20 + (assessment.marker ?? .5) * 60;
  const label = unavailableReason === 'started' ? t('Pétrissage prévu déjà passé', 'Planned mixing time has passed')
    : unavailableReason === 'unsupported' ? t('Créneau non calculé', 'Window not calculated')
    : blocked ? t('Plan à revoir', 'Review this plan')
    : overdue ? t('Horaire dépassé', 'Time has passed')
      : inWindow && busy ? t('Horaire à ajuster', 'Timing needs adjusting')
      : inWindow ? t('Dans le créneau', 'Within the window')
        : status === 'early' ? t('Avant le créneau conseillé', 'Before the recommended window')
          : status === 'late' ? t('Après le créneau conseillé', 'After the recommended window')
            : t('Créneau non disponible', 'Window unavailable');
  const explanation = unavailableReason === 'started'
    ? t('Déjà commencé ? Suivez le guide. Sinon, choisissez un nouvel horaire.', 'Already started? Follow the guide. Otherwise, choose a new time.')
    : unavailableReason === 'unsupported'
      ? t('Pour ce style, le calcul est disponible en pâte directe à levure boulangère.', 'For this style, timing guidance is available for direct dough with commercial yeast.')
    : blocked
    ? t('Ce plan ne peut pas être suivi tel quel. Revoyez l’heure de cuisson.', 'This plan cannot be followed as it stands. Review your bake time.')
    : overdue
      ? t('Si vous n’avez pas commencé, choisissez un nouvel horaire.', 'If you have not started, choose a new time.')
      : status === 'early'
        ? t('La durée dépasse la plage conseillée. Pétrissez plus tard en gardant votre heure de cuisson.', 'Fermentation is longer than advised. Mix later while keeping your bake time.')
        : status === 'late'
          ? t('La durée est plus courte que conseillé. Pétrissez plus tôt en gardant votre heure de cuisson.', 'Fermentation is shorter than advised. Mix earlier while keeping your bake time.')
          : inWindow
            ? t('Votre pétrissage respecte la plage conseillée pour ce plan.', 'Your mixing time fits the recommended range for this plan.')
            : t('Ce réglage ne fournit pas de créneau fiable. Vérifiez les signes de fermentation au moment de préparer et de cuire.', 'This setting does not provide a reliable window. Check fermentation signs when mixing and baking.');
  const preferment = prefermentType.toLowerCase();
  const hasPreferment = isSourdough || preferment === 'poolish' || preferment === 'biga';
  const prefermentName = isSourdough ? t('Levain', 'Starter') : preferment === 'biga' ? 'Biga' : 'Poolish';
  const prefermentNote = isSourdough && validDate(starterPeak)
    ? `${t('Pic estimé', 'Estimated peak')} · ${format(starterPeak)}`
    : t('Maturité à vérifier au pétrissage', 'Check maturity at mixing');

  return (
    <section aria-labelledby={titleId} style={{
      border: '1px solid var(--border)', borderRadius: 16, padding: '16px',
      marginBottom: 20, background: 'var(--cream, #f5f2ea)', color: 'var(--char, #29241f)',
      fontFamily: 'var(--font-ui)', minWidth: 0,
    }}>
      <h3 id={titleId} style={{fontSize: 17, lineHeight: 1.3, fontWeight: 600, margin: '0 0 8px'}}>
        {t('Votre créneau de pétrissage', 'Your mixing window')}
      </h3>
      <div style={{fontSize: 12, lineHeight: 1.4, marginBottom: 8}}>{t('Repère de planning estimé', 'Estimated timing guide')}</div>
      <div aria-live="polite" aria-atomic="true">
        <span style={{
          display: 'inline-flex', gap: 6, alignItems: 'center', borderRadius: 20,
          padding: '4px 9px', fontSize: 13, fontWeight: 500,
          background: clearWindow ? '#e6eadf' : outside ? '#f2e4d7' : '#e9e6df',
          color: clearWindow ? '#3b4d32' : outside ? '#794522' : '#504a43',
        }}>
          <span aria-hidden="true">{clearWindow ? '✓' : outside || blocked || overdue ? '!' : '—'}</span>{label}
        </span>
        {!inWindow && <p style={{fontSize: 14, lineHeight: 1.4, margin: '8px 0'}}>{explanation}</p>}
      </div>

      {hasWindow && (
        <div style={{marginTop: 12}}>
          <div style={{fontSize: 12, marginBottom: 5}}>{t('Plage conseillée', 'Recommended range')}</div>
          <div style={{display: 'grid', gridTemplateColumns: '40% 20% 40%', fontSize: 13, lineHeight: 1.35, textAlign: 'center'}}>
            <time dateTime={windowFrom!.toISOString()}>{format(windowFrom!)}</time>
            <time dateTime={windowTo!.toISOString()} style={{gridColumn: 3}}>{format(windowTo!)}</time>
          </div>
          <div aria-hidden="true" style={{height: 20, position: 'relative', margin: '5px 0'}}>
            <div style={{position: 'absolute', left: 0, right: 0, top: 7, height: 6, borderRadius: 8, background: '#ddd8ce'}} />
            <div style={{position: 'absolute', left: '20%', width: '60%', top: 4, height: 12, borderRadius: 8, background: '#abb49a'}} />
            {<div style={{
              position: 'absolute', left: `${marker}%`, top: 1, width: 4, height: 18,
              transform: 'translateX(-50%)', borderRadius: 2, background: 'var(--char, #29241f)',
              boxShadow: '0 0 0 2px var(--cream, #f5f2ea)',
            }} />}
          </div>
        </div>
      )}
      <div style={{fontSize: 13, lineHeight: 1.4}}>
        {t('Pétrissage prévu', 'Planned mixing')} · {validDate(mixTime) ? format(mixTime) : '—'}
      </div>
      <div style={{fontSize: 13, lineHeight: 1.4}}>
        {t('Cuisson prévue', 'Planned bake')} · {validDate(bakeTime) ? format(bakeTime) : '—'}
      </div>
      {hasPreferment && <div style={{fontSize: 13, lineHeight: 1.4, marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8}}>
        <strong style={{fontWeight: 500}}>{prefermentName}</strong> · {prefermentNote}
        {isSourdough && starterState !== null && starterState !== 'green' && (
          <div>{t('Vérifiez son activité avant de l’utiliser.', 'Check its activity before using it.')}</div>
        )}
      </div>}
      {busy && <p style={{fontSize: 13, lineHeight: 1.4, margin: '8px 0 0'}}>
        {conflictDescription ?? t('Une étape tombe pendant une indisponibilité.', 'A step falls during an unavailable period.')}
      </p>}
      {canEdit && busy && !unavailableReason && onApplyRepair && repairLabel && <>
        <p style={{fontSize:13,lineHeight:1.4,margin:'8px 0 0'}}>{t('Proposition vérifiée avec vos indisponibilités.', 'Proposal checked against your unavailable times.')}</p>
        <button type="button" onClick={onApplyRepair} style={{minHeight:44,width:'100%',marginTop:8,padding:'9px 12px',font:'inherit',fontSize:16,border:'1px solid var(--terra)',borderRadius:10,background:'var(--terra)',color:'#fff',cursor:'pointer'}}>{repairLabel}</button>
      </>}
      {canEdit && busy && onReviewAvailability && <button type="button" onClick={onReviewAvailability} style={{
        minHeight: 44, width: '100%', marginTop: 8, padding: '9px 12px', font: 'inherit', fontSize: 16,
        border: '1px solid var(--border)', borderRadius: 10, background: 'transparent', color: 'var(--char)', cursor: 'pointer',
      }}>{t('Vérifier mes disponibilités', 'Review my availability')}</button>}
      {canEdit && busy && !onApplyRepair && <button type="button" onClick={onEditBake} style={{
        minHeight:44,width:'100%',padding:'9px 12px',font:'inherit',fontSize:16,
        border:0,background:'transparent',color:'var(--char)',cursor:'pointer',textDecoration:'underline',
      }}>{t('Ajuster la cuisson', 'Adjust bake time')}</button>}
      {canEdit && !busy && !unavailableReason && (outside || blocked || overdue) && <button type="button" onClick={blocked ? onEditBake : onEditMix} style={{
        minHeight: 44, minWidth: 44, width: '100%', marginTop: 12, padding: '9px 12px',
        font: 'inherit', fontSize: 16, fontWeight: 500, color: 'var(--char, #29241f)',
        background: 'transparent', border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer',
      }}>{blocked ? t('Ajuster la cuisson', 'Adjust bake time') : t('Ajuster le pétrissage', 'Adjust mixing time')}</button>}
      <details style={{marginTop: 4, fontSize: 13, lineHeight: 1.5}}>
        <summary style={{minHeight: 44, display: 'list-item', alignContent: 'center', cursor: 'pointer', fontSize: 16}}>
          {t('Comment vérifier ?', 'What should I check?')}
        </summary>
        <p style={{margin: '4px 0 8px'}}>
          {t('Les horaires vous guident ; vérifiez aussi l’évolution de la pâte.', 'Use the timings as a guide and check how the dough develops.')}
          {' '}{t('Observez une pâte qui prend du volume et devient aérée ; son aspect dépend du style.', 'Look for dough gaining volume and becoming aerated; its appearance depends on the style.')}
        </p>
        {hasPreferment && <p style={{margin: '0 0 8px'}}>
          {isSourdough
            ? t('Levain : cherchez une montée visible et des bulles.', 'Starter: look for visible rise and bubbles.')
            : preferment === 'biga'
              ? t('Biga : vérifiez une structure aérée à l’intérieur. Sa surface ferme ne se lit pas comme celle d’un poolish.', 'Biga: check for an aerated interior. Its firm surface looks different from poolish.')
              : t('Poolish : cherchez des bulles et une surface aérée ; un affaissement marqué invite à vérifier son état.', 'Poolish: look for bubbles and an aerated surface; marked collapse calls for checking its condition.')}
        </p>}
        {!isSourdough && <p style={{margin: '0 0 8px'}}>{t('La quantité de levure s’adapte aux horaires et aux températures.', 'The yeast quantity adjusts to your timing and temperatures.')}</p>}
        {Number.isFinite(kitchenTemp) && Number.isFinite(fridgeTemp) && <p style={{margin: 0}}>
          {t('Températures du plan', 'Plan temperatures')} : {t('pièce', 'room')} {kitchenTemp} °C · {t('réfrigérateur', 'fridge')} {fridgeTemp} °C.
        </p>}
      </details>
    </section>
  );
}
