# Bread image framing and matching tartine bases

Captions now occupy their own row below a 126px photo frame, so the loaf is centered in the visible image rather than partly covered by text. Bread-only examples use a compact centered image area instead of an extremely wide letterbox.

Two catalogue-specific images were generated with the built-in image-generation tool, using the original corresponding topping photo as the edit reference. They override only the bread discovery example; the shared recipe photographs and recipe ingredients remain unchanged.

Saved assets:
- `public/images/approved/sandwich/tartine-seigle-chevre-v2.webp`
- `public/images/approved/sandwich/tartine-mie-jambon-v2.webp`

Rye prompt:
> Create a matching photorealistic food catalogue image for Bakerhub, editing the reference. Keep goat cheese, honey and walnuts, rustic wooden board on warm beige stone, natural soft light and three-quarter overhead camera. Replace the pale country-bread base with an unmistakable dense dark brown rye bread slice: compact fine brown crumb, modest small pores, dark thin crust, oval slice from a rye loaf. Entire tartine centered horizontally and vertically, all bread edges visible with generous even 15% margins, suitable for square or landscape card. No extra ingredients, no text or graphics. Save output image.

Pain de mie prompt:
> Use case precise-object-edit. Matching photorealistic food catalogue image. Preserve cooked ham and Emmental cheese topping, wooden board, warm beige stone and natural light. Replace rustic oval country bread with ONE unmistakable square slice of French pain de mie from a sandwich tin: soft fine white even crumb, thin smooth golden crust, straight sides and square corners, no large holes or flour crust. Show the white crumb thickness and all four bread edges clearly. Open-faced tartine only, no top slice, no extra ingredients. Center entire tartine horizontally and vertically with even generous margins, three-quarter overhead camera, landscape4:3. No text or graphics.

## Pain de mie recipe expansion

Following the user's next request, the primary pain de mie example is now the club sandwich, with dedicated club and croque-monsieur recipes. The generated ham tartine above remains a saved alternate asset. Recipe photography was generated with the built-in tool and saved to:
- `public/images/approved/sandwich/pain_mie-club-sandwich.webp`
- `public/images/approved/sandwich/pain_mie-croque-monsieur.webp`

Club prompt:
> Photorealistic food catalogue photo for Bakerhub. A proper classic club sandwich made with THREE square lightly toasted slices of fine white pain de mie, two filling layers of sliced cooked chicken, crisp cooked bacon, lettuce, tomato and a little mayonnaise. Cut diagonally into two triangular halves, placed beside each other so three distinct bread layers and fillings are clearly visible; wooden cocktail picks holding each half, no fries or sides. Rustic wooden board on warm beige stone, soft natural daylight, three-quarter overhead camera, centered complete sandwich with even margins. Landscape4:3, no text/logos. Match warm natural bakery catalogue photography.

Croque prompt:
> Photorealistic Bakerhub food catalogue photo. One classic French croque-monsieur made of TWO square slices of fine white pain de mie with cooked ham and Emmental between them, creamy béchamel and bubbling golden gratinéed Emmental on top. Cut into two rectangles with one half offset slightly so the ham layer and exactly two bread slices are visible. No egg, no salad, no fries, no extra ingredients. Rustic wooden board on warm beige stone, natural soft daylight, three-quarter overhead camera. Whole sandwich centered with even margins, landscape4:3, no text or logo. Appetizing but realistic homemade bake.

Recipe implementation: dedicated `pain_mie` family; club uses 3 slices / 90g baked bread and croque uses 2 slices / 60g. The summary totals slices separately from loaf count. Bread-dependent toasting, assembly and croque oven cooking appear at serving after the loaf has cooled. Mustard and nutmeg are opt-in. A partial deletion of the béchamel's milk/flour/butter requires correction; completion is blocked until corrected. Removing all three explicitly produces a variation without béchamel. Existing saved pain-de-mie tartine selections remain usable until the user chooses to replace them.

Recipe structure references: https://www.bbcgoodfood.com/recipes/club-sandwich and https://www.atelierdeschefs.fr/recettes/13755/croque-monsieur-bechamel/ . Portions and nutrition remain editorial estimates; no physical cooking trial is claimed.

Validation: production build/i18n/TypeScript and265 automated tests passed. All40 focused WebKit cases passed across320/375/390/430px through passing runs:36 initially; four newclub cases passed after narrowing a test's milk selector that also matched lettuce. Image loading and caption separation assertions passed for allfive loaf examples. Independent390px Chrome review covered club/croque shopping, prep, assembly and cooking. A separate Chrome check preserved a legacy pain-de-mie tartine and verified explicit replacement. No physical cooking trial.
