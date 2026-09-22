'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { SANDWICH_FAMILIES, SANDWICH_RECIPES, SANDWICH_INGREDIENTS } from '../lib/sandwichCatalog';
import { type SandwichSnapshot, sandwichFamilyForStyle, effectiveIngredients, estimatedSandwichKcal, aggregateSandwichShopping, sandwichPrepKey, updateSandwichRecipe, effectiveSandwichSteps, isLighterSandwich } from '../lib/sandwich';
import styles from './sandwichParty/SandwichParty.module.css';
import CompanionSteps from './CompanionSteps';
import { breadCompanionLabel } from '../lib/companionLabels';
import { BREAD_STYLES } from '../data';
import { useBottomNavHeight } from '../hooks/useBottomNavHeight';

type Recipe = typeof SANDWICH_RECIPES[number];
type Translation = {fr:string; en:string};
type Filter = 'all' | 'classic' | 'light' | 'vegetarian';
export interface SandwichPartyProps {
  isFr: boolean;
  styleKey: string | null;
  snapshot: SandwichSnapshot;
  onChange: (snapshot: SandwichSnapshot) => void;
  /** Whole bread recipe, already calculated by the dough engine. */
  breadIngredients?: Array<{id:string; name:string; grams:number}>;
  availableDoughWeight?: number;
  numItems?: number;
  onAdjustBread?: () => void;
  hideNavigation?: boolean;
  onRevealNavigation?: () => void;
  doughConfigured?: boolean;
}

const count = (value: number) => Number.isFinite(value) ? Math.max(0,Math.min(99,Math.floor(value))) : 0;

export default function SandwichParty({isFr,styleKey,snapshot,onChange,breadIngredients=[],availableDoughWeight,numItems,onAdjustBread,hideNavigation=false,doughConfigured=true,onRevealNavigation}:SandwichPartyProps) {
  const tr = (value:Translation) => value[isFr ? 'fr' : 'en'];
  const t = (fr:string,en:string) => isFr ? fr : en;
  const bottomNavH = useBottomNavHeight();
  const [search,setSearch] = useState('');
  const [reviewOpen,setReviewOpen] = useState(false);
  const [filter,setFilter] = useState<Filter>('all');
  const [detailId,setDetailId] = useState<string|null>(null);
  const detailHeading = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const configuredFamilyId = styleKey ? sandwichFamilyForStyle(styleKey) : null;
  const familyId = configuredFamilyId;
  const family = SANDWICH_FAMILIES.find(item => item.id === familyId);
  const tartine = familyId === 'tartine';
  const selectedBread = styleKey ? (BREAD_STYLES as Record<string,{name:string;nameFr:string;image:string}>)[styleKey] : undefined;
  const breadName = selectedBread ? (isFr ? selectedBread.nameFr : selectedBread.name) : family ? tr(family.name) : '';
  const breadImage = selectedBread?.image ?? family?.image;
  const destinationName = breadCompanionLabel(family?.id,isFr);
  const heading = family ? `${isFr?'Vos':'Your'} ${destinationName.toLocaleLowerCase(isFr?'fr':'en')}` : t('Garnitures','Fillings');
  const familyRecipes = SANDWICH_RECIPES.filter(recipe => recipe.familyId === family?.id);
  const selected = familyRecipes.filter(recipe => count(snapshot.qtys[recipe.id]) > 0);
  const total = selected.reduce((sum,recipe) => sum+count(snapshot.qtys[recipe.id]),0);
  useEffect(()=>{if(total===0)setReviewOpen(false);},[total]);
  const completed = selected.reduce((sum,recipe) => sum+Math.min(count(snapshot.completed[recipe.id]),count(snapshot.qtys[recipe.id])),0);
  const detail = familyRecipes.find(recipe => recipe.id === detailId);
  useEffect(() => {
    if (detailId && !detail) setDetailId(null);
  }, [detailId, detail]);
  const tab = snapshot.tab;
  const ingredientsFor = (recipe:Recipe) => effectiveIngredients(recipe,snapshot.ingredientOverrides?.[recipe.id]);
  const ingredient = (id:string) => SANDWICH_INGREDIENTS[id];
  const ingredientName = (id:string) => ingredient(id) ? tr(ingredient(id).name) : id;
  const kcal = (recipe:Recipe) => estimatedSandwichKcal(recipe,snapshot.ingredientOverrides?.[recipe.id]);
  const lighter = (recipe:Recipe) => isLighterSandwich(recipe,snapshot.ingredientOverrides?.[recipe.id]);
  const stepsFor = (recipe:Recipe) => effectiveSandwichSteps(recipe,snapshot.ingredientOverrides?.[recipe.id]);
  const update = (patch:Partial<SandwichSnapshot>) => onChange({...snapshot,...patch,familyId:family?.id ?? snapshot.familyId});
  const go = (next:SandwichSnapshot['tab']) => { update({tab:next}); headingRef.current?.scrollIntoView({block:'start'}); };
  const setQuantity = (recipe:Recipe,value:number) => {
    onChange(updateSandwichRecipe({...snapshot,familyId:family?.id ?? null},recipe.id,count(value),snapshot.ingredientOverrides?.[recipe.id]));
  };
  useEffect(() => {
    if (!detailId && !reviewOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';closeRef.current?.focus();
    const onKey = (event:KeyboardEvent) => {
      if (event.key === 'Escape') {event.preventDefault();setDetailId(null);setReviewOpen(false);}
      if (event.key !== 'Tab') return;
      const controls = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),summary,[tabindex="0"]') ?? [])];
      const first=controls[0],last=controls[controls.length-1];
      if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus();}
    };
    document.addEventListener('keydown',onKey);
    return () => {document.body.style.overflow=overflow;document.removeEventListener('keydown',onKey);previous?.focus({preventScroll:true});onRevealNavigation?.();};
  },[detailId,reviewOpen]);

  const quantityControls = (recipe:Recipe) => <div className={styles.quantity}>
    <span className={styles.quantityLabel}>{tartine ? t('Tartines','Toasts') : t('Sandwichs','Sandwiches')}</span>
    <button className={styles.button} type="button" aria-label={`${t('Retirer un','Remove one')} ${tr(recipe.name)}`} disabled={!count(snapshot.qtys[recipe.id])} onClick={()=>setQuantity(recipe,count(snapshot.qtys[recipe.id])-1)}>−</button>
    <input aria-label={`${t('Quantité','Quantity')} ${tr(recipe.name)}`} type="number" inputMode="numeric" min={0} max={99} value={count(snapshot.qtys[recipe.id])} onChange={event=>setQuantity(recipe,Number(event.target.value))}/>
    <button className={styles.button} type="button" aria-label={`${t('Ajouter un','Add one')} ${tr(recipe.name)}`} disabled={count(snapshot.qtys[recipe.id])>=99} onClick={()=>setQuantity(recipe,count(snapshot.qtys[recipe.id])+1)}>+</button>
  </div>;
  const shopping = aggregateSandwichShopping(snapshot.qtys,snapshot.ingredientOverrides,family?.id);
  const breadGrams = selected.reduce((sum,recipe)=>sum+recipe.breadGrams*count(snapshot.qtys[recipe.id]),0);
  // Baked weight cannot be inferred precisely from raw dough. Exceeding the
  // raw amount is nevertheless a definite shortfall for these bread portions.
  const insufficientBread = Number.isFinite(availableDoughWeight) && availableDoughWeight! > 0 && breadGrams > availableDoughWeight!;
  const normalizeSearch = (value:string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const filtered = familyRecipes.filter(recipe=>normalizeSearch(tr(recipe.name)+' '+ingredientsFor(recipe).map(item=>ingredientName(item.ingredientId)).join(' ')).includes(normalizeSearch(search))).filter(recipe=>filter==='classic'?recipe.kind==='classic':filter==='light'?lighter(recipe):filter==='vegetarian'?recipe.vegetarian:true);
  const prepSteps = selected.flatMap(recipe=>stepsFor(recipe).filter(step=>step.phase!=='assemble').map(step=>({recipe,step,key:sandwichPrepKey(recipe,step.id,count(snapshot.qtys[recipe.id]),snapshot.ingredientOverrides?.[recipe.id])})));
  const readySteps = prepSteps.filter(item=>snapshot.prepTicks[item.key]).length;
  const amountText = (grams:number) => grams>=1000 ? `${(Math.round(grams/10)/100).toLocaleString(isFr?'fr-FR':'en-GB')} kg` : `${(grams<10?Math.round(grams*10)/10:Math.round(grams)).toLocaleString(isFr?'fr-FR':'en-GB')} g`;
  const button = `${styles.button} ${styles.primary}`;

  return <div className={styles.party}>
    <div className={styles.hero}>
      <div><h2 ref={headingRef} tabIndex={-1}>{heading}</h2>
        <div className={styles.muted}>{breadName}</div>
      </div>
      {family && <img src={breadImage} alt={breadName}/>}
    </div>
    {family && <>
      {!hideNavigation && <CompanionSteps label={t('Étapes des sandwichs','Sandwich steps')} active={tab} onChange={go}
        steps={[{key:'pick',label:t('Choisir','Choose')},{key:'shop',label:t('Courses','Shopping')},{key:'prep',label:t('Préparer','Prepare')},{key:'serve',label:t('Servir','Serve')}]} />}
      {total>0 && <div className={styles.summary} aria-live="polite">
        <strong>{total} {tartine ? t('tartines','toasts') : t('sandwichs','sandwiches')}</strong> · {t('Pain à prévoir','Bread needed')} ≈ {amountText(breadGrams)}
        <div className={styles.muted}>{tartine ? t('Une portion de tartine = 60 g de pain, soit une grande tranche ou plusieurs petites.','One toast portion = 60 g of bread: one large slice or several small ones.') : t('Les quantités comptent les sandwichs, pas les pains.','Quantities count sandwiches, not loaves.')}
          {numItems && availableDoughWeight ? ` ${t('Votre fournée','Your batch')} : ${numItems} ${t('pièce(s)','piece(s)')} · ${amountText(availableDoughWeight)} ${t('de pâte avant cuisson','dough before baking')}.` : ''}</div>
      </div>}
      {total>0 && insufficientBread && <div className={styles.card} role="status" style={{marginBottom:16}}>
        <strong>{t('Prévoyez davantage de pain','You will need more bread')}</strong>
        <p className={styles.muted}>{t('Cette sélection demande plus de pain cuit que le poids de pâte prévu. La cuisson fait aussi perdre de l’eau : augmentez la fournée ou réduisez les portions.','This selection needs more baked bread than your planned dough weight. Baking also removes water: increase the batch or reduce the portion count.')}</p>
        {onAdjustBread&&<button className={styles.button} type="button" onClick={onAdjustBread}>{t('Ajuster ma fournée','Adjust my bread batch')}</button>}
      </div>}
      {tab==='pick' && <>
        <input className={styles.search} type="search" aria-label={t('Rechercher une recette ou un ingrédient','Search recipes or ingredients')} placeholder={t('Une recette, un ingrédient…','A recipe, an ingredient…')} value={search} onChange={event=>setSearch(event.target.value)} />

        <div className={styles.filters} aria-label={t('Filtrer les recettes','Filter recipes')}>
          {(['all','classic','light','vegetarian'] as const).map((value,index)=><button key={value} className={`${styles.button} ${styles.filter}`} type="button" aria-pressed={filter===value} onClick={()=>setFilter(value)}>{[t('Tout','All'),t('Traditionnels','Traditional'),t('Plus légers','Lighter'),t('Végétariens','Vegetarian')][index]}</button>)}
        </div>
        {filter==='light' && <p className={styles.muted}>{t('Au moins 20 % de calories en moins que la moyenne des classiques de ce pain, aux portions indiquées. Pain inclus.','At least 20% fewer calories than the classics for this bread on average, at the listed portions. Bread included.')}</p>}
        <div className={styles.grid}>{filtered.map(recipe=><article key={recipe.id} className={`${styles.card} ${styles.recipeCard} ${count(snapshot.qtys[recipe.id])?styles.selected:''}`}>
          <button type="button" className={styles.photoButton} aria-label={`${t('Voir la recette','View recipe')} ${tr(recipe.name)}`} onClick={()=>setDetailId(recipe.id)}>
            <img className={styles.recipePhoto} src={tartine ? breadImage : recipe.image} alt={tr(recipe.name)} width={640} height={480} loading="lazy" decoding="async"/>
          </button>
          <button type="button" className={styles.detailButton} onClick={()=>setDetailId(recipe.id)}><h3>{tr(recipe.name)}</h3></button>
          <div className={styles.tags}><span className={styles.tag}>{Object.keys(snapshot.ingredientOverrides?.[recipe.id]??{}).length?t('Personnalisé','Customized'):recipe.kind==='classic'?t('Traditionnel','Traditional'):t('Création','Inspired')}</span>{lighter(recipe)&&<span className={styles.tag}>{t('Plus léger','Lighter')}</span>}{recipe.vegetarian&&<span className={styles.tag}>{t('Végétarien','Vegetarian')}</span>}</div>
          <p className={styles.muted}>{ingredientsFor(recipe).map(item=>ingredientName(item.ingredientId)).join(' · ')}</p>
          <div className={styles.muted}>≈ {kcal(recipe)} kcal / {t('sandwich, pain inclus','sandwich, bread included')}</div>
          <div className={styles.muted}>{recipe.breadGrams} g {t('de pain cuit + garnitures','baked bread + fillings')}</div>
          {quantityControls(recipe)}
          <button className={`${styles.button} ${styles.wide}`} type="button" onClick={()=>setDetailId(recipe.id)}>{t('Recette et garnitures','Recipe and fillings')}</button>
        </article>)}</div>
        {!filtered.length&&<p className={styles.empty}>{t('Aucune recette dans ce filtre. Essayez « Tout ».','No recipes in this filter. Try “All”.')}</p>}
        {total>0&&!reviewOpen&&<div data-companion-action className={styles.selectionBar} style={{bottom:bottomNavH}}><button type="button" className={`${button} ${styles.wide}`} onClick={()=>setReviewOpen(true)}>{t('Voir ma sélection','Review selection')} · {total}</button></div>}

      </>}
      {tab!=='pick'&&!total&&<div className={styles.empty}><p>{tartine ? t('Choisissez vos tartines et leurs quantités pour commencer.','Choose your toasts and quantities to begin.') : t('Choisissez vos sandwichs et leurs quantités pour commencer.','Choose your sandwiches and quantities to begin.')}</p><button className={button} type="button" onClick={()=>go('pick')}>{tartine ? t('Choisir mes tartines','Choose toasts') : t('Choisir mes sandwichs','Choose sandwiches')}</button></div>}
      {tab==='shop'&&total>0&&<>
        {!doughConfigured && <div className={styles.card}><p>{t('Cette liste contient les garnitures. Complétez votre pâte pour ajouter les ingrédients du pain.','This list contains fillings. Finish your dough plan to include the bread ingredients.')}</p>{onAdjustBread&&<button className={styles.button} type="button" onClick={onAdjustBread}>{t('Compléter ma pâte','Finish my dough')}</button>}</div>}
        <h3>{t('Pain pour cette sélection','Bread for this selection')}</h3>
        <p>{t('Prévoyez','Allow')} ≈ {amountText(breadGrams)} {t('de pain cuit pour votre sélection.','of baked bread for your selection.')}</p>
        {breadIngredients.length>0&&<details><summary className={styles.button}>{t('Ingrédients de ma fournée de pain','My bread batch ingredients')}</summary><p className={styles.muted}>{t('Fournée complète ; les quantités ne sont pas multipliées par le nombre de portions.','Whole batch; amounts are not multiplied by the portion count.')}</p>
          {breadIngredients.map(item=><label key={item.id} className={styles.check}><input type="checkbox" checked={!!snapshot.shopTicks[`dough:${item.id}:${item.grams}`]} onChange={event=>update({shopTicks:{...snapshot.shopTicks,[`dough:${item.id}:${item.grams}`]:event.target.checked}})}/><span className={snapshot.shopTicks[`dough:${item.id}:${item.grams}`]?styles.checked:''}>{item.name}</span><strong className={styles.checkAmount}>{amountText(item.grams)}</strong></label>)}
        </details>}
        <div className={styles.panelHeading}><h3>{t('Garnitures regroupées','Combined fillings')}</h3></div>
        {shopping.map(({ingredientId:id,grams,key})=><label key={id} className={styles.check}><input type="checkbox" checked={!!snapshot.shopTicks[key]} onChange={event=>update({shopTicks:{...snapshot.shopTicks,[key]:event.target.checked}})}/><span className={snapshot.shopTicks[key]?styles.checked:''}>{ingredientName(id)}</span><strong className={styles.checkAmount}>{amountText(grams)}</strong></label>)}
        <button type="button" className={`${button} ${styles.wide}`} onClick={()=>go('prep')}>{t('Passer aux préparations','Start preparation')} →</button>
      </>}
      {tab==='prep'&&total>0&&<>
        <h3>{t('Préparez les garnitures','Prepare the fillings')}</h3><p className={styles.muted}>{readySteps}/{prepSteps.length} {t('étapes cochées','steps checked')} · {t('Les quantités ci-dessous suivent votre sélection.','Quantities below follow your selection.')}</p>
        {selected.map(recipe=><section className={styles.card} key={recipe.id} style={{marginBottom:12}}><h3>{tr(recipe.name)} · {count(snapshot.qtys[recipe.id])}</h3>
          <p className={styles.muted}>{ingredientsFor(recipe).map(item=>`${ingredientName(item.ingredientId)} ${amountText(item.grams*count(snapshot.qtys[recipe.id]))}`).join(' · ')}</p>
          {stepsFor(recipe).filter(step=>step.phase!=='assemble').map(step=>{const key=sandwichPrepKey(recipe,step.id,count(snapshot.qtys[recipe.id]),snapshot.ingredientOverrides?.[recipe.id]);return <label key={key} className={styles.check}><input type="checkbox" checked={!!snapshot.prepTicks[key]} onChange={event=>update({prepTicks:{...snapshot.prepTicks,[key]:event.target.checked}})}/><span className={snapshot.prepTicks[key]?styles.checked:''}><strong>{tr(step.title)}</strong>{step.minutes>0?` · ≈ ${step.minutes} min`:''}<br/>{tr(step.instruction)}</span></label>;})}
          <button className={`${styles.button} ${styles.wide}`} type="button" onClick={()=>setDetailId(recipe.id)}>{t('Voir la recette','View recipe')}</button>
        </section>)}
        <button type="button" className={`${button} ${styles.wide}`} onClick={()=>go('serve')}>{t('Passer à l’assemblage','Start assembly')} →</button>
      </>}
      {tab==='serve'&&total>0&&<>
        <div className={styles.panelHeading}><h3>{t('Assembler et servir','Assemble and serve')}</h3><span aria-live="polite">{completed}/{total}</span></div>
        <p className={styles.muted}>{t('Laissez refroidir le pain avant de le garnir, sauf indication contraire de la recette.','Let bread cool before filling, unless the recipe says otherwise.')}</p>
        {completed===total&&<p role="status">{t('Tout est prêt. Bon appétit !','Everything is ready. Enjoy!')}</p>}
        {selected.map(recipe=>{const done=Math.min(count(snapshot.completed[recipe.id]),count(snapshot.qtys[recipe.id]));const qty=count(snapshot.qtys[recipe.id]);return <section key={recipe.id} className={styles.card} style={{marginBottom:12}}>
          <div className={styles.cardTop}><h3>{tr(recipe.name)}</h3><span>{done}/{qty}</span></div>
          <ol className={styles.steps}>{stepsFor(recipe).filter(step=>step.phase==='assemble').map(step=><li key={step.id}><strong>{tr(step.title)}</strong>{tr(step.instruction)}</li>)}</ol>
          <div className={styles.filters}><button type="button" className={button} disabled={done>=qty} onClick={()=>update({completed:{...snapshot.completed,[recipe.id]:done+1}})}>{tartine ? t('Une tartine prête','One toast ready') : t('Un sandwich prêt','One sandwich ready')}</button><button type="button" className={styles.button} disabled={!done} onClick={()=>update({completed:{...snapshot.completed,[recipe.id]:done-1}})}>{t('Annuler le dernier','Undo last')}</button></div>
        </section>;})}
      </>}
    </>}
    {reviewOpen && total>0 && <div className={styles.backdrop} onClick={event=>{if(event.target===event.currentTarget)setReviewOpen(false);}}>
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-label={t('Ma sélection','My selection')} ref={dialogRef}>
        <div className={styles.sheetHeader}><h2>{t('Ma sélection','My selection')}</h2><button ref={closeRef} type="button" className={styles.button} aria-label={t('Fermer la sélection','Close selection')} onClick={()=>setReviewOpen(false)}>×</button></div>
        <div className={styles.sheetBody}>{selected.map(recipe=><div key={recipe.id} className={styles.card}><strong>{tr(recipe.name)}</strong>{quantityControls(recipe)}</div>)}</div>
        <div className={styles.sheetFooter}><button type="button" className={`${button} ${styles.wide}`} style={{marginTop:0}} onClick={()=>{setReviewOpen(false);go('shop');}}>{t('Préparer mes courses','Build my shopping list')} →</button></div>
      </div>
    </div>}
    {detail&&family&&<div className={styles.backdrop} onClick={event=>{if(event.target===event.currentTarget)setDetailId(null);setReviewOpen(false);}}>
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby={detailHeading} ref={dialogRef}>
        <div className={styles.sheetHeader}><h2 id={detailHeading}>{tr(detail.name)}</h2><button type="button" ref={closeRef} className={styles.button} aria-label={t('Fermer la recette','Close recipe')} onClick={()=>setDetailId(null)}>×</button></div>
        <div className={styles.sheetBody}>
          <img className={styles.recipePhoto} src={tartine ? breadImage : detail.image} alt={tr(detail.name)} width={640} height={480} decoding="async"/>
          {Object.keys(snapshot.ingredientOverrides?.[detail.id]??{}).length>0&&<p className={styles.muted}>{t('Photo de la recette de base ; vos garnitures ont été personnalisées.','Photo shows the original recipe; you have customized the fillings.')}</p>}
          <p className={styles.muted}>{tartine ? t('Pour une portion de tartine','For one toast portion') : t('Pour un sandwich','For one sandwich')} · ≈ {kcal(detail)} kcal · {t('pain inclus','bread included')}</p>
          <h3>{t('Pain','Bread')}</h3><p>{breadName} · ≈ {detail.breadGrams} g</p>
          <p className={styles.muted}>{t('Calories estimées avec des aliments génériques ; le pain et les marques peuvent modifier le résultat.','Calories use generic food estimates; bread and brands can change the result.')}</p>
          <h3>{tartine ? t('Garnitures par portion','Toppings per portion') : t('Garnitures par sandwich','Fillings per sandwich')}</h3>
          <p className={styles.muted}>{t('Ajustez les grammes ; 0 retire un ingrédient. Les courses et calories suivent vos changements.','Adjust grams; 0 removes an ingredient. Shopping quantities and calories follow your changes.')}</p>
          {detail.ingredients.map(item=><div key={item.ingredientId} className={styles.ingredient}><label htmlFor={`${detailHeading}-${item.ingredientId}`}>{ingredientName(item.ingredientId)}</label><input id={`${detailHeading}-${item.ingredientId}`} type="number" inputMode="decimal" min={0} max={500} step={5} value={snapshot.ingredientOverrides?.[detail.id]?.[item.ingredientId]??item.grams} onChange={event=>{const value=Number(event.target.value);onChange(updateSandwichRecipe({...snapshot,familyId:family.id},detail.id,count(snapshot.qtys[detail.id]),{...snapshot.ingredientOverrides?.[detail.id],[item.ingredientId]:Number.isFinite(value)?Math.max(0,Math.min(500,value)):item.grams}));}}/><span>g</span></div>)}
          {snapshot.ingredientOverrides?.[detail.id]&&<button type="button" className={`${styles.button} ${styles.wide}`} onClick={()=>{onChange(updateSandwichRecipe({...snapshot,familyId:family.id},detail.id,count(snapshot.qtys[detail.id]),{}));}}>{t('Rétablir les garnitures','Reset fillings')}</button>}
          <p className={styles.muted}>{t('Allergènes de la recette de base','Base recipe allergens')} : {detail.allergens.map(allergen=>({gluten:t('gluten','gluten'),milk:t('lait','milk'),egg:t('œuf','egg'),fish:t('poisson','fish'),sesame:t('sésame','sesame'),nuts:t('fruits à coque','nuts'),mustard:t('moutarde','mustard'),soy:t('soja','soy')}[allergen])).join(', ')}. {t('Vérifiez les étiquettes de vos produits.','Check your product labels.')}</p>
          <h3 style={{marginTop:22}}>{t('Préparation et cuisson','Preparation and cooking')}</h3><ol className={styles.steps}>{stepsFor(detail).map(step=><li key={step.id}><strong>{tr(step.title)}{step.minutes>0?` · ≈ ${step.minutes} min`:''}</strong>{tr(step.instruction)}</li>)}</ol>
          {quantityControls(detail)}
        </div>
        <div className={styles.sheetFooter}><button type="button" className={`${button} ${styles.wide}`} style={{marginTop:0}} onClick={()=>setDetailId(null)}>{t('Terminé','Done')}</button></div>
      </div>
    </div>}
  </div>;
}
