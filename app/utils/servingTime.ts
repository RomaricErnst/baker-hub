import { breadActiveCookMinutes, getBreadProtocol } from './breadProfiles';
import { leanBreadMinutes } from './leanBreadBake';

export interface ServingTimeInput {
  bakeType: 'bread' | 'pizza';
  styleKey: string;
  numItems: number;
  itemWeight: number;
  ovenType: string;
  hasFillings?: boolean;
  /** The first selected pizza's existing topping heat band; never assume one. */
  pizzaOvenTemp?: 'high' | 'mid' | 'low';
}
export interface ServingTimeEstimate {
  minutes: number;
  labelFr: string;
  labelEn: string;
  noteFr: string;
  noteEn: string;
}

/** Upper endpoints of BakeGuide.breadCoolingRange; keep boundary rules aligned.
 * This is a planning allowance, not a measured cooling model.
 */
export function breadCoolingUpperMinutes(style: string, weight: number): number | null {
  if (!Number.isFinite(weight) || weight <= 0) return null;
  return style === 'pain_seigle' ? 1440 : style === 'fougasse' && weight <= 500 ? 15 : style === 'baguette' && weight <= 400 ? 30 : style === 'pain_viennois' && weight <= 400 ? 60 : weight <= 400 ? 120 : weight <= 1000 ? 180 : 240;
}

// Numeric cooling instructions already present in BREAD_PROTOCOLS.
const PROFILE_COOLING: Readonly<Record<string, number>> = {focaccia:15, bagel:20, ciabatta:30};
// Ovens with a lean-bread bake card. Bake minutes come from leanBreadMinutes,
// the same table the guide prints; round loaves in a wood-fired oven keep the
// 40–50 min of messages bake.woodBread.
const LOAF_OVENS: readonly string[] = ['standard_bread','home_oven_stone_bread','steam_oven','dutch_oven','wood_fired'];
const WOOD_LOAF_COOK = 50;
// Upper endpoints of the oven + topping heat bands in pizzaParty/BakeTab.
// Narrowly applied to thin round styles; no pan/deep-dish timing is inferred.
const PIZZA_COOK: Readonly<Record<string, readonly [number,number,number]>> = {
  pizza_oven:[1.5,2,3], electric_pizza:[3,4,5], home_oven_steel:[7,8,9],
  home_oven_standard:[10,11,12],
};

/** Offset from the existing bakeStart, which already follows preheating and bagel
 * poaching. Does not schedule filling preparation, assembly, oven recovery or
 * unknown batch capacity. Null means retain the explicit start-of-cooking field.
 */
export function getServingTimeEstimate(input: ServingTimeInput): ServingTimeEstimate | null {
  const {bakeType,styleKey,numItems,itemWeight,ovenType,hasFillings=false,pizzaOvenTemp}=input;
  if (!Number.isInteger(numItems) || numItems < 1 || numItems > 99 || !Number.isFinite(itemWeight) || itemWeight <= 0) return null;
  if (bakeType === 'pizza') {
    if (!['neapolitan','newyork','pizza_romana','sourdough'].includes(styleKey) || !pizzaOvenTemp) return null;
    const minutes=PIZZA_COOK[ovenType]?.[{high:0,mid:1,low:2}[pizzaOvenTemp]];
    if (!minutes) return null;
    return {minutes,labelFr:'Première pizza prête (estimation)',labelEn:'First pizza ready (estimate)',
      noteFr:'Haut de la plage du guide pour la première pizza, four déjà préchauffé. Vérifiez la cuisson ; les suivantes arrivent ensuite. Préparation des garnitures et service non inclus.',
      noteEn:'Upper end of the guide range for the first pizza, with the oven already preheated. Check doneness; later pizzas follow. Topping preparation and serving are not included.'};
  }
  if (bakeType !== 'bread') return null;
  const profile=getBreadProtocol(styleKey);
  let minutes: number;
  let batchFr='Une seule pièce au four ; vérifiez la cuisson et le refroidissement avant de couper.';
  let batchEn='One item in the oven; check doneness and cooling before cutting.';
  if (profile) {
    if (!profile.equipment.includes(ovenType) || itemWeight !== profile.portions.weight) return null;
    if (profile.cooking === 'griddle') {
      // These protocols explicitly serve/fill warm, without a separate timed wait.
      // Batbout asks for cooling before opening and has no numeric cooling time.
      if (!['greek_pita','piadina'].includes(styleKey)) return null;
      minutes=breadActiveCookMinutes(styleKey,numItems);
      batchFr='Une pièce à la fois à la poêle, haut de la plage du guide. Gardez les pains sous un torchon ; garnissez seulement lorsqu’ils sont manipulables.';
      batchEn='One bread at a time on the griddle, using the upper end of the guide range. Keep covered with a towel; fill only when safe to handle.';
    } else {
      const cooling=PROFILE_COOLING[styleKey];
      if (numItems !== 1 || cooling === undefined) return null;
      minutes=profile.cookMinutes[1]+cooling;
    }
  } else {
    // Lean breads only: the guide's bake card gives each a time range for its
    // piece weight. Multiple loads require oven-capacity information.
    const range=leanBreadMinutes(styleKey,itemWeight);
    if (numItems !== 1 || !range || !LOAF_OVENS.includes(ovenType)) return null;
    const cook=ovenType==='wood_fired'&&['pain_campagne','pain_levain','pain_complet'].includes(styleKey)?WOOD_LOAF_COOK:range[1];
    const cooling=breadCoolingUpperMinutes(styleKey,itemWeight);
    if (cooling === null) return null;
    minutes=cook+cooling;
    batchFr='Une seule pièce au four ; haut des plages indicatives de cuisson et refroidissement du guide. La durée de cuisson et le refroidissement suivent le poids de la pièce : vérifiez le pain avant de couper.';
    batchEn='One item in the oven; upper ends of the guide’s indicative bake and cooling ranges. Bake time and cooling both follow the weight of the piece: check the bread before cutting.';
  }
  return {minutes,labelFr:hasFillings?'Pain prêt à garnir (estimation)':profile?.cooking==='griddle'?'Pains cuits, à servir tièdes (estimation)':'Pain prêt à trancher (estimation)',labelEn:hasFillings?'Bread ready to fill (estimate)':profile?.cooking==='griddle'?'Breads cooked, serve warm (estimate)':'Bread ready to slice (estimate)',
    noteFr:`${batchFr}${hasFillings?' Préparation des garnitures et assemblage non inclus ; ce n’est pas l’heure du repas.':''}`,
    noteEn:`${batchEn}${hasFillings?' Filling preparation and assembly are not included; this is not the meal time.':''}`};
}
