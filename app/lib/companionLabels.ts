/** Short destination names stay stable across setup and the generated recipe. */
export function breadCompanionLabel(family: string | null | undefined, fr: boolean): string {
  const names: Record<string, string> = {
    baguette: fr ? 'Sandwichs' : 'Sandwiches', focaccia: 'Focaccias', ciabatta: 'Ciabattas',
    pan_bagnat: 'Pans bagnats', panuozzo: 'Panuozzi', bagel: 'Bagels',
    pita: 'Pitas', greek_pita: 'Pitas', kebab_bread: 'Kebabs', batbout: 'Batbouts',
    laffa: 'Laffas', piadina: fr ? 'Piadinas' : 'Piadine',
  };
  return family && Object.prototype.hasOwnProperty.call(names, family) ? names[family] : (fr ? 'Garnitures' : 'Fillings');
}
