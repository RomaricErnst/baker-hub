import { breadActiveCookMinutes, getBreadProtocol } from './breadProfiles';

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
  return style === 'pain_seigle' ? 1440 : ['baguette','fougasse','pain_viennois'].includes(style) && weight <= 400 ? 60 : weight <= 400 ? 120 : weight <= 1000 ? 180 : 240;
}

// Numeric cooling instructions already present in BREAD_PROTOCOLS.
const PROFILE_COOLING: Readonly<Record<string, number>> = {focaccia:15, bagel:20, ciabatta:30};
// Existing messages/en.json bake.*Bread / bake.dutch / bake.steam steps.
const LOAF_COOK: Readonly<Record<string, number>> = {standard_bread:45,home_oven_stone_bread:45,steam_oven:45,dutch_oven:45,wood_fired:50};
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
    // The generic loaf bake guidance does not establish timings for enriched
    // loaves or thin baguettes. Multiple loads require oven-capacity information.
    if (numItems !== 1 || !['pain_campagne','pain_levain','pain_complet','pain_seigle'].includes(styleKey)) return null;
    const cook=LOAF_COOK[ovenType];
    const cooling=breadCoolingUpperMinutes(styleKey,itemWeight);
    if (!cook || cooling === null) return null;
    minutes=cook+cooling;
    batchFr='Une seule pièce au four ; haut des plages indicatives de cuisson et refroidissement du guide. Le poids modifie le refroidissement estimé, pas la durée de cuisson : vérifiez le pain avant de couper.';
    batchEn='One item in the oven; upper ends of the guide’s indicative bake and cooling ranges. Weight changes the cooling allowance, not bake duration: check the bread before cutting.';
  }
  return {minutes,labelFr:hasFillings?'Pain prêt à garnir (estimation)':profile?.cooking==='griddle'?'Pains cuits, à servir tièdes (estimation)':'Pain prêt à trancher (estimation)',labelEn:hasFillings?'Bread ready to fill (estimate)':profile?.cooking==='griddle'?'Breads cooked, serve warm (estimate)':'Bread ready to slice (estimate)',
    noteFr:`${batchFr}${hasFillings?' Préparation des garnitures et assemblage non inclus ; ce n’est pas l’heure du repas.':''}`,
    noteEn:`${batchEn}${hasFillings?' Filling preparation and assembly are not included; this is not the meal time.':''}`};
}
