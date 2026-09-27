# Finished sandwich and tartine imagery

88 recipe-specific illustrations generated using the built-in image-generation tool, one distinct image per recipe. Final project assets are `public/images/approved/sandwich/{recipe.id}.webp`, 1000 × 750 pixels, WebP quality 84. Exact prompts and original output filenames are recorded in `SANDWICH-IMAGE-PROMPTS.json`.

The bread-style catalogue and selected-bread hero retain their bread photographs. Recipe cards and detail sheets now show the prepared dish and use the localized recipe name as alternative text. Customized fillings keep the original illustration and the existing explanatory caption, including tartines.

Each recipe's listed ingredients and bread format were checked during generation. Drafts with unlisted ingredients were rejected and regenerated. These are generated illustrations of the base recipes, not photographs of physically tested dishes. Tartines illustrate the filling on a representative rustic slice; the selected bread remains named in the hero and ingredient section.

`node scripts/check-sandwich-images.cjs` checks all 88 catalogue paths, full image decoding, static WebP format, landscape 4:3 dimensions and duplicate pixels. It does not judge ingredient correctness. The mobile CI runs this check before building.

Local application verification: 231 unit tests passed following the mapping change; the component test covers all recipe names/images and preserves the selected rye-bread hero independently of the avocado-and-egg dish image. Final asset and preview CI results are recorded in the handoff when available.

The separate six-section navigation redesign is documented in `NAVIGATION-SIX-SECTIONS-20260922.md`. It must be based on this completed imagery checkpoint and published to its own preview branch.
