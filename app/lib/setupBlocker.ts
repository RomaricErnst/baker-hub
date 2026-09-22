export interface SetupBlocker {
  stepId: number;
  reason: string;
  action: string;
}

export interface SetupBlockerInput {
  custom: boolean;
  fr: boolean;
  protocolIssue?: 'method' | 'equipment' | 'timing';
  unsupportedMixer: boolean;
  unsupportedMethod: boolean;
  sourdough: boolean;
  hasPreferment: boolean;
  prefermentPlanReady: boolean;
  starterPlanReady: boolean;
  archivedFlour: boolean;
  requirementsComplete: boolean;
  missingRequiredStep?: number;
}

/** Navigation advice only: never changes or bypasses recipe validation. */
export function getSetupBlocker(input: SetupBlockerInput): SetupBlocker | undefined {
  const {custom,fr}=input;
  const plan=custom?9:7;
  const words=(frText:string,enText:string)=>fr?frText:enText;
  const block=(stepId:number,reasonFr:string,reasonEn:string,actionFr:string,actionEn:string):SetupBlocker=>({stepId,reason:words(reasonFr,reasonEn),action:words(actionFr,actionEn)});
  if(input.archivedFlour&&custom) return block(6,'Choisissez une farine disponible pour remplacer la farine archivée.','Replace the archived flour with an available flour.','Revoir les farines','Review flours');
  // A protocol "method" issue can mean mixing equipment, not just fermentation.
  if(input.protocolIssue==='equipment'||input.unsupportedMixer) return block(3,'Cet équipement ne convient pas au pain choisi.','This equipment is not supported for the selected bread.','Revoir l’équipement','Review equipment');
  if(input.protocolIssue==='method'||input.unsupportedMethod) {
    const preferment=custom&&!input.sourdough&&input.hasPreferment;
    return block(preferment?8:custom?7:6,'La méthode choisie ne convient pas à cette pâte.','The selected method is not supported for this dough.',preferment?'Revoir le préferment':'Revoir la levure',preferment?'Review preferment':'Review yeast');
  }
  if(input.protocolIssue==='timing') return block(plan,'Le temps prévu ne permet pas de préparer ce pain.','The planned timing does not allow this bread to be prepared.','Ajuster le plan','Adjust the plan');
  if(!input.prefermentPlanReady) return block(plan,'Le planning du préferment reste à compléter.','The preferment schedule still needs to be completed.','Compléter le plan','Complete the plan');
  if(!input.starterPlanReady) return block(plan,'Le planning du levain reste à compléter.','The starter schedule still needs to be completed.','Compléter le plan','Complete the plan');
  if(!input.requirementsComplete) return block(input.missingRequiredStep??plan,'Un choix reste à compléter avant de créer la recette.','Complete the remaining choice before creating the recipe.','Compléter ce choix','Complete this choice');
  return undefined;
}
