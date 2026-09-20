'use client';
import {useId} from 'react';
import { displayTemp, displayWeight, cToDisplay, inputTempToC, tempUnit, type UnitSystem } from '../utils/units';
export type WaterSource = 'room' | 'fridge' | 'tap' | 'measured';
export type WaterMethod = 'premelt' | 'direct';
export interface WaterSettingsProps {
  measuredWaterTemp?: number;
  onMeasuredWaterTempChange?: (value: number | undefined) => void;
  waterMethod?: WaterMethod;
  onWaterMethodChange?: (value: WaterMethod) => void;
  spiralIceConfirmed?: boolean;
  onSpiralIceConfirmedChange?: (value: boolean) => void;
}
interface Props extends WaterSettingsProps {
  readOnly?: boolean;
  waterGrams: number; targetTemp: number; kitchenTemp: number; fridgeTemp: number;
  locale: string; units?: UnitSystem; source?: WaterSource;
  onSourceChange?: (source: WaterSource) => void;
  idealWaterTemp?: number; targetDoughTemp?: number; achievedDoughTempC?: number;
  waterWasClamped?: boolean; directIceSupported?: boolean;
}
// Ice at 0°C; 79.8 is latent heat divided by water's specific heat.
// Direct mixing uses the unconstrained water-energy equivalent from the dough solver.
export function directIcePreparation(waterGrams: number, idealWaterTemp: number, sourceTemp: number) {
  if (![waterGrams,idealWaterTemp,sourceTemp].every(Number.isFinite) || waterGrams<=0 || sourceTemp<0) return null;
  const fraction=(sourceTemp-idealWaterTemp)/(79.8+sourceTemp);
  if (fraction<0 || fraction>1) return null;
  const total=Math.round(waterGrams),ice=Math.round(total*fraction);
  return {water:total-ice,ice};
}
export function waterPreparation(waterGrams: number, targetTemp: number, sourceTemp: number) {
  if (![waterGrams,targetTemp,sourceTemp].every(Number.isFinite) || waterGrams<=0 || targetTemp<0 || sourceTemp<0) return null;
  return directIcePreparation(waterGrams,Math.min(targetTemp,sourceTemp),sourceTemp);
}
export default function WaterPreparation({waterGrams,targetTemp,kitchenTemp,fridgeTemp,locale,units='metric',source='room',onSourceChange,
  measuredWaterTemp,onMeasuredWaterTempChange,waterMethod='premelt',onWaterMethodChange,spiralIceConfirmed=false,onSpiralIceConfirmedChange,
  idealWaterTemp,targetDoughTemp,achievedDoughTempC,waterWasClamped=false,directIceSupported=false,readOnly=false}:Props) {
  const fieldId=useId();
  const fr=locale==='fr', entered=source==='tap'||source==='measured';
  const starting=entered ? measuredWaterTemp : source==='room'?kitchenTemp:fridgeTemp;
  const direct=waterMethod==='direct'&&directIceSupported;
  const allowed=!direct||spiralIceConfirmed;
  const target=direct?idealWaterTemp:targetTemp;
  const split=allowed&&starting!=null&&target!=null ? direct ? directIcePreparation(waterGrams,target,starting) : waterPreparation(waterGrams,target,starting) : null;
  const clamped=!direct&&idealWaterTemp!=null&&Math.abs(idealWaterTemp-targetTemp)>.1;
  // The solver's clipped-water result is useful only when this preparation
  // cannot use direct ice to hit the unconstrained target. Keep the residual
  // beside the recipe so the baker knows what to change, rather than leaving
  // a generic "unreachable" warning with no measured consequence.
  const thermalGap = Boolean(waterWasClamped && targetDoughTemp!=null && achievedDoughTempC!=null
    && Math.abs(achievedDoughTempC-targetDoughTemp)>.1 && (!direct || !split));
  const thermalGapText = thermalGap && targetDoughTemp!=null && achievedDoughTempC!=null
    ? (() => {
        const residualC=achievedDoughTempC-targetDoughTemp;
        const residual=units==='imperial' ? `${residualC>0?'+':''}${Math.round(residualC*9/5)} °F` : `${residualC>0?'+':''}${residualC.toFixed(1)} °C`;
        return fr
          ? `Après pétrissage prévu : ${displayTemp(achievedDoughTempC,units)} au lieu de ${displayTemp(targetDoughTemp,units)} (${residual}).`
          : `Predicted after mixing: ${displayTemp(achievedDoughTempC,units)} vs ${displayTemp(targetDoughTemp,units)} target (${residual}).`;
      })()
    : null;
  const thermalAction = thermalGap && achievedDoughTempC!=null && targetDoughTemp!=null
    ? achievedDoughTempC>targetDoughTemp
      ? fr
        ? 'Refroidissez la farine avant le mélange ou utilisez la glace directe avec un pétrin compatible, puis contrôlez la pâte.'
        : 'Chill the flour before mixing or use direct ice with a compatible mixer, then check the dough.'
      : fr
        ? 'Réchauffez l’eau ou la farine avant le mélange, puis contrôlez la pâte.'
        : 'Warm the water or flour before mixing, then check the dough.'
    : null;
  if (readOnly) return <div style={{marginTop:6,fontSize:13}}>
    {split ? <>
      <div>{displayWeight(split.water,units)} {fr ? 'eau' : 'water'} · {displayTemp(split.ice > 0 || direct ? starting! : targetTemp,units)}</div>
      {split.ice > 0 && <div>{displayWeight(split.ice,units)} {fr ? 'glace' : 'ice'}</div>}
      {!direct && split.ice > 0 && <div>{fr ? 'Après fonte complète' : 'After melting completely'} · {displayWeight(split.water + split.ice,units)} · {displayTemp(targetTemp,units)}</div>}
      {direct && split.ice > 0 && <div>{fr ? 'Glace ajoutée au pétrin' : 'Ice added in the mixer'}</div>}
      {thermalGapText && <p>{thermalGapText}</p>}
      {thermalAction && <p>{thermalAction}</p>}
      {clamped && !thermalGap && <p>{fr ? 'Cible de pâte inaccessible avec cette préparation. Revoyez les réglages de la cuisine.' : 'This preparation cannot reach the dough target. Review kitchen settings.'}</p>}
    </> : <>{thermalGapText ? <><p>{thermalGapText}</p><p>{thermalAction}</p></> : <span>{fr ? 'Complétez la préparation de l’eau dans les réglages de la cuisine.' : 'Complete water preparation in kitchen settings.'}</span>}</>}
  </div>;
  return <div style={{marginTop:6}}>
    {targetDoughTemp!=null&&<p style={{margin:'0 0 8px'}}>{fr?'Pâte après pétrissage':'Dough after mixing'} · <strong>{displayTemp(targetDoughTemp,units)}</strong></p>}
    {!readOnly && onSourceChange && <div role="group" aria-label={fr?'Source de l’eau':'Water source'} style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:6}}>
      {(['room','fridge','tap','measured'] as const).map(key=><button key={key} type="button" aria-pressed={source===key} onClick={()=>onSourceChange(key)} style={{minHeight:40,padding:'5px 9px',border:'1px solid var(--border)',borderRadius:8,background:source===key?'var(--terra)':'transparent',color:source===key?'white':'inherit'}}>{({room:fr?'Ambiante':'Room',fridge:fr?'Frigo':'Fridge',tap:fr?'Robinet':'Tap',measured:fr?'Mesurée':'Measured'})[key]}</button>)}
    </div>}
    {!readOnly&&entered&&onMeasuredWaterTempChange&&<label style={{display:'block',marginBottom:8}}>{fr?'Température de l’eau':'Water temperature'} ({tempUnit(units)}) <input aria-label={`${fr?'Température de l’eau':'Water temperature'} (${tempUnit(units)})`} type="number" min={units==='imperial'?32:0} max={units==='imperial'?140:60} step={units==='imperial'?1:0.5} value={measuredWaterTemp==null?'':units==='imperial'?cToDisplay(measuredWaterTemp,units):measuredWaterTemp} onChange={e=>onMeasuredWaterTempChange(e.target.value===''?undefined:inputTempToC(Number(e.target.value),units))} style={{width:80}} /></label>}
    {!readOnly&&directIceSupported&&onWaterMethodChange&&<details style={{marginBottom:8}}><summary>{fr?'Méthode de refroidissement':'Cooling method'}</summary>
      <label><input type="radio" name={fieldId} checked={!direct} onChange={()=>onWaterMethodChange('premelt')} />{fr?'Eau préparée séparément':'Prepare water separately'}</label><br/>
      <label><input type="radio" name={fieldId} checked={direct} onChange={()=>onWaterMethodChange('direct')} />{fr?'Glace dans le pétrin à spirale':'Ice in spiral mixer'}</label>
      {direct&&<label style={{display:'block'}}><input type="checkbox" checked={spiralIceConfirmed} onChange={e=>onSpiralIceConfirmedChange?.(e.target.checked)} />{fr?'Mon pétrin autorise les glaçons.':'My mixer allows ice cubes.'}</label>}
    </details>}
    <strong>{starting==null ? (fr?'Saisissez la température pour calculer la glace.':'Enter the water temperature to calculate ice.') : !allowed ? (fr?'Confirmez la compatibilité du pétrin.':'Confirm mixer compatibility.') : !split ? (fr?'Cible inaccessible avec cette eau et cette méthode.':'Target cannot be reached with this water and method.') : split.ice>0 ? `${displayWeight(split.water,units)} ${fr?'eau':'water'} + ${displayWeight(split.ice,units)} ${fr?'glace':'ice'}` : `${displayWeight(split.water,units)} ${fr?'eau':'water'}${!direct?` · ${displayTemp(targetTemp,units)}`:''}`}</strong>
    {split&&<div>{direct ? (fr?'Ajoutez l’eau et la glace, puis commencez à pétrir. La glace fond pendant le pétrissage.':'Add the water and ice, then start mixing. The ice melts during mixing.') : split.ice>0 ? (fr?'Remuez la glace dans l’eau jusqu’à fonte complète, puis utilisez cette eau pour la pâte.':'Stir the ice into the water until melted, then use this water in the dough.') : starting!=null&&starting<targetTemp ? (fr?'Réchauffez l’eau à la température indiquée.':'Warm the water to the temperature shown.') : null}</div>}
    {thermalGapText&&<div>{thermalGapText}</div>}
    {thermalAction&&<div>{thermalAction}</div>}
    {clamped&&!thermalGap&&<div>{fr?'Cette eau seule ne permet pas d’atteindre la température de pâte visée.':'This water alone cannot reach the target dough temperature.'}</div>}
    <details style={{marginTop:4}}><summary style={{cursor:'pointer'}}>{fr?'Températures et hypothèses':'Temperatures & assumptions'}</summary>
      <div>{starting!=null?`${entered?(fr?'Eau saisie':'Entered water'):(fr?'Eau estimée':'Estimated water')}: ${displayTemp(starting,units)}. `:''}{!direct?`${fr?'Eau préparée':'Prepared water'}: ${displayTemp(targetTemp,units)}.`:''}</div>
      <div>{fr?'Glace supposée à 0 °C. Vérifiez la pâte après pétrissage avec un thermomètre.':'Assumes ice at 0°C. Check dough after mixing with a thermometer.'}</div>
      {direct&&<div>{fr?'Estimation d’énergie ; la friction réelle du pétrin varie.':'Energy estimate; actual mixer friction varies.'}</div>}
      {!directIceSupported&&<div>{fr?'Glace directe non proposée pour ce matériel ou cette recette.':'Direct ice is not offered for this equipment or recipe.'}</div>}
      {(clamped||!split)&&<div>{fr?'Refroidissez la farine ou adaptez le pétrissage avant de recalculer.':'Chill the flour or adjust mixing before recalculating.'}</div>}
    </details>
  </div>;
}
