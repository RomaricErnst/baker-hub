export const BAKE_DESTINATIONS = [
  {id:'batch',fr:'Ma fournée',en:'My bake'},
  {id:'organisation',fr:'Organisation',en:'Organisation'},
  {id:'recipe',fr:'Recette',en:'Recipe'},
  {id:'shopping',fr:'Courses',en:'Shopping'},
  {id:'protocol',fr:'Préparation',en:'Preparation'},
  {id:'service',fr:'Cuisson & service',en:'Cooking & serving'},
] as const;
export type BakeDestination = typeof BAKE_DESTINATIONS[number]['id'];
export type BakeRoute = 'batch'|'setup'|'plan'|'shopping'|'guide'|'service'|'pizzaparty'|'sandwiches';
export type BatchView = 'style'|'quantity'|'fillings';
export interface BakeNavigationMemory {
  batchView?: BatchView;
  protocolView?: 'dough'|'fillings';
  serviceView?: 'dough'|'fillings';
  returnTo?: {destination:'protocol'|'service'|'recipe'|'shopping';view:'dough'|'fillings'}|null;
}
export function destinationForRoute(route:string,pizzaPhase='pick',sandwichPhase='pick'):BakeDestination {
  if(route==='setup')return 'organisation';
  if(route==='plan')return 'recipe';
  if(route==='guide')return 'protocol';
  if(route==='shopping'||route==='service')return route;
  if(route==='pizzaparty'||route==='sandwiches'){
    const phase=route==='pizzaparty'?pizzaPhase:sandwichPhase;
    return phase==='shop'?'shopping':phase==='prep'?'protocol':phase==='bake'||phase==='serve'?'service':'batch';
  }
  return 'batch';
}
export function routeForDestination(destination:BakeDestination):BakeRoute {
  return ({batch:'batch',organisation:'setup',recipe:'plan',shopping:'shopping',protocol:'guide',service:'service'} as const)[destination];
}
export function normalizeNavigation(value:unknown):BakeNavigationMemory {
  const v=value&&typeof value==='object'?value as Record<string,unknown>:{};
  const returnTo=v.returnTo&&typeof v.returnTo==='object'?v.returnTo as Record<string,unknown>:{};
  return {
    batchView:['style','quantity','fillings'].includes(String(v.batchView))?v.batchView as BatchView:'style',
    protocolView:v.protocolView==='fillings'?'fillings':'dough',
    serviceView:v.serviceView==='fillings'?'fillings':'dough',
    returnTo:(returnTo.destination==='protocol'||returnTo.destination==='service'||returnTo.destination==='recipe'||returnTo.destination==='shopping')&&(returnTo.view==='dough'||returnTo.view==='fillings')?{destination:returnTo.destination,view:returnTo.view}:null,
  };
}
export function restoredBakeRoute(input:{activeTab?:string;navigation?:unknown;activeStep?:number;advancedStep?:number;tab?:string;modeChosen?:boolean;setupOverview?:boolean;styleKey?:string|null;bakeType?:string|null;pizzaPartyTab?:string;sandwichParty?:{tab?:string}|null},supportsFillings:boolean):{route:BakeRoute;memory:BakeNavigationMemory}{
  const memory=normalizeNavigation(input.navigation);
  const old=input.activeTab??'setup';
  let destination=destinationForRoute(old,input.pizzaPartyTab,input.sandwichParty?.tab);
  const step=input.tab==='custom'?input.advancedStep:input.activeStep;
  if(!input.navigation&&old==='setup'&&!input.setupOverview&&(!input.modeChosen||typeof step==='number'&&step>0&&step<=2)){destination='batch';memory.batchView=input.styleKey&&step===2?'quantity':'style';}
  if(old==='pizzaparty'||old==='sandwiches'){
    if((old==='pizzaparty'&&input.bakeType!=='pizza')||(old==='sandwiches'&&!supportsFillings))destination='batch';
    else if(destination==='batch')memory.batchView='fillings';
    else if(destination==='protocol')memory.protocolView='fillings';
    else if(destination==='service')memory.serviceView='fillings';
  }
  if(!input.styleKey){destination='batch';memory.batchView='style';}
  if(!supportsFillings&&input.bakeType!=='pizza'){
    if(memory.batchView==='fillings')memory.batchView=input.styleKey?'quantity':'style';
    memory.protocolView='dough';memory.serviceView='dough';memory.returnTo=null;
  }
  return {route:routeForDestination(destination),memory};
}
