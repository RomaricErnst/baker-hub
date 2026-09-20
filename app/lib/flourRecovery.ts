import { FLOUR_DB, FLOUR_ARCHIVE } from '../../lib/flourDatabase';
import legacy from '../../lib/flourLegacyCatalogue.json';
import type { FlourBlend } from '../data';
const key = (name: string) => name.trim().toLocaleLowerCase();
const activeNames = new Set(FLOUR_DB.map(f => key(`${f.brand} ${f.name}`)));
const archivedNames = new Set([...legacy, ...FLOUR_ARCHIVE].map(f => key(`${f.brand} ${f.name}`)).filter(name => !activeNames.has(name)));
/** Retain saved names and numerical snapshots; never substitute another product. */
export function archivedBlendSelections(blend: FlourBlend): string[] {
  const names = [blend.brandProduct, blend.flour2 ? blend.customFlour2Name : undefined, blend.flour3 ? blend.customFlour3Name : undefined];
  return names.filter((name): name is string => !!name && archivedNames.has(key(name)));
}
