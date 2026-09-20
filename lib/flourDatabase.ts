import catalogue from './flourCatalogue.json';
import archived from './flourArchive.json';
import legacy from './flourLegacyCatalogue.json';
import provenance from './flourPhotoProvenance.json';

/** Published facts stay distinct from calculation estimates; null is unknown. */
export type FlourEntry = {
  id: string; brand: string; name: string; type: string; country: string;
  w: number | null; wPublished: boolean; protein: number | null;
  hydration: [number, number] | null; bestFor: string[]; crowdFavourite: string[];
  note: string; bagImage: string; logo: string | null;
  proteinPublished?: boolean; hydrationPublished?: boolean;
  proteinRange?: [number, number]; proteinRangePublished?: boolean;
  proteinSpec?: {operator: string; value?: number; min?: number; max?: number; published?: boolean};
  wRange?: [number, number]; wRangePublished?: boolean; wApproximate?: boolean;
  manufacturerType?: string; catalogStatus?: string; bagImageSource?: string;
  verification?: {status?: string; fields?: string[]; source?: string; checked?: string};
  specificationNote?: {en: string; fr: string};
  [key: string]: unknown;
};
export const FLOUR_DB = catalogue as unknown as FlourEntry[];
export const FLOUR_ARCHIVE = archived as unknown as FlourEntry[];
export const FLOUR_PHOTO_PROVENANCE = provenance;
const current = new Map(FLOUR_DB.map(flour => [flour.id, flour]));
const history = new Map([...legacy, ...archived].map(flour => [flour.id, flour as unknown as FlourEntry]));
/** Recovery is explicit: never substitute a different SKU or enable an archived one. */
export function resolveSavedFlour(id: string): {status: 'selectable' | 'archived' | 'unknown'; flour?: FlourEntry} {
  const active = current.get(id);
  if (active) return {status: 'selectable', flour: active};
  const prior = history.get(id);
  return prior ? {status: 'archived', flour: prior} : {status: 'unknown'};
}
export function getFlourById(id: string): FlourEntry | undefined { return current.get(id); }
export function isSelectableFlour(id: string): boolean { return current.has(id); }
