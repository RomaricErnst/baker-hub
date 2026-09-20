// Approved catalogue photos use a consistent plate and framing. Style remains
// a recipe choice; legacy style-specific image variants are not approved.
export function approvedPizzaImage(pizzaId: string): string {
  return `/pizzas/${pizzaId}.webp`;
}
