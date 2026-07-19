import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Baker Hub's stated philosophy (from the About page) — keeps Maestro's
// voice and reasoning consistent with how the app explains itself.
const APP_PHILOSOPHY = `Baker Hub philosophy (align with this): you bake around real life — the baker sets the bake time and the app works backwards. Every fermentation formula in baking books was developed at a temperate 18-22°C; in warmer kitchens they over-ferment, so Baker Hub recalculates the actual biology at the baker's kitchen temperature (a 5°C change roughly halves or doubles fermentation rate). YEAST IS ALWAYS AN OUTPUT, NEVER AN INPUT — the scheduler fixes the fermentation hours, then the yeast engine computes the exact quantity from those hours and the temperature. Longer/warmer → less yeast; shorter/colder → more. Status indicators reflect real fermentation QUALITY, not just whether something is possible. Be an empathetic companion: guide, never alarm; frame cautions as observations.`;

// ── Bread style groups ────────────────────────────────────────────────────────
const BAGUETTE_STYLES  = ['baguette', 'fougasse'];
const BOULE_STYLES     = ['pain_campagne', 'pain_levain', 'sourdough', 'pain_complet', 'pain_seigle'];
const LOAF_TIN_STYLES  = ['brioche', 'pain_mie', 'pain_viennois'];
const BREAD_STYLES     = [...BAGUETTE_STYLES, ...BOULE_STYLES, ...LOAF_TIN_STYLES];

function isBaguette(sk: string) { return BAGUETTE_STYLES.includes(sk); }
function isBoule(sk: string)    { return BOULE_STYLES.includes(sk); }
function isLoafTin(sk: string)  { return LOAF_TIN_STYLES.includes(sk); }
function isBread(sk: string)    { return BREAD_STYLES.includes(sk); }
function isNeapolitan(sk: string) { return sk === 'neapolitan'; }
function isPan(sk: string)      { return sk === 'pan'; }
function isRoman(sk: string)    { return sk === 'roman' || sk === 'pizza_romana'; }

function buildSystemPrompt(stepId: string, styleKey: string, ovenType?: string, pizzaName?: string, beforeBake?: string[], afterBake?: string[]): string {
  const base = `You are an expert bread and pizza coach. Reply in this EXACT structure, nothing else:
Line 1: a 2–5 word verdict (e.g. "Ready to use", "Not yet — give it ~30 min", "Past peak but usable").
Line 2: the single most useful action right now, one short sentence.
Line 3 (only if genuinely needed): one thing to watch, one short sentence.
Never exceed 3 lines. No paragraphs, no greetings. Be honest — do not soften real problems or invent praise, but never be harsh. For ambiguous photos be measured — you are reading a photo, not touching the dough. Never say "I can see" or "the image shows". Never mention the photo.`;

  switch (stepId) {

    case 'poolish':
      return `${base} You are reviewing a poolish (liquid pre-ferment). Assess readiness: look for a domed or slightly domed surface, bubbles throughout, possible slight recession from peak. Flat = not ready. Collapsed or very wet = over-fermented. Visual assessment of fermentation has limits — if ambiguous, suggest the baker also check the smell (yeasty and slightly alcoholic = ready) and gently tilt the container to check for jiggle.`;

    case 'biga':
      return `${base} You are reviewing a biga (stiff pre-ferment). Assess readiness: look for roughly doubled volume, holes and bubbles when broken, slight dome. Dense and unchanged = not ready yet. Visual assessment has limits for a stiff dough — if ambiguous, suggest the baker break off a small piece to check for interior bubbles and a slightly alcoholic smell.`;

    case 'starter':
      return `${base} You are reviewing a sourdough starter or levain. Assess readiness: look for a domed surface at or just past peak, bubbles throughout, volume doubled. Flat = needs more time. Collapsed = past peak. If ambiguous from the photo, suggest the baker do the float test (drop a small amount in water — floats = ready) and check for a tangy yeasty smell.`;

    case 'mix':
      if (isNeapolitan(styleKey)) {
        return `${base} You are reviewing Neapolitan pizza dough after mixing. Look for: smooth silky surface with slight sheen, dough that holds its shape, no dry patches. If this shows a windowpane test: it should stretch thin and translucent without tearing.`;
      }
      if (isBaguette(styleKey)) {
        return `${base} You are reviewing baguette dough after mixing. Look for: smooth cohesive surface, moderate elasticity. Baguette dough should be slightly tacky but not sticky, with visible gluten structure.`;
      }
      if (isBoule(styleKey)) {
        return `${base} You are reviewing sourdough or country bread dough after mixing. Look for: shaggy but cohesive mass at this stage — full gluten development comes through folds. Assess hydration management: is the dough holding together?`;
      }
      return `${base} You are reviewing bread or pizza dough after mixing. Look for: smooth surface, elasticity, cohesion. Windowpane test if shown: translucent stretch without tearing.`;

    case 'bulk':
      return `${base} You are reviewing dough after bulk fermentation. Assess readiness to shape: look for 50-80% volume increase, domed top, bubbles visible under the surface or on sides, slight jiggle when the container is moved. Flat with no bubbles = needs more time. Overly slack and very jiggly = over-fermented. If the photo is ambiguous, suggest the poke test — a gentle finger poke should leave an indent that springs back slowly; fast spring-back means under-fermented, no spring-back means over-fermented.`;

    case 'shape':
      if (isBaguette(styleKey)) {
        return `${base} You are reviewing a shaped baguette. Look for: even taper at both ends, uniform thickness along the length, taut smooth surface with no tears. The seam should be on the bottom. Uneven thickness or a blunt end means re-shape before proofing.`;
      }
      if (isBoule(styleKey)) {
        return `${base} You are reviewing a shaped boule or country loaf. Look for: smooth taut dome, no tears on the surface, even round shape. The seam should be on the bottom. A smooth drum-tight surface means good shaping.`;
      }
      if (isLoafTin(styleKey)) {
        return `${base} You are reviewing dough shaped for a loaf tin. Look for: an even log that fills the tin width evenly, smooth surface, seam tucked underneath. Uneven ends or an air gap on one side should be corrected.`;
      }
      if (isNeapolitan(styleKey)) {
        return `${base} You are reviewing a Neapolitan pizza dough ball. Look for: smooth taut surface with no tears, round shape, seam pinched tight underneath. The ball should hold its shape and not spread flat immediately — that indicates under-tension.`;
      }
      return `${base} You are reviewing shaped dough. Look for: smooth taut surface, correct form for the style, seam on the bottom, no tears.`;

    case 'open':
      if (isNeapolitan(styleKey)) {
        return `${base} You are reviewing an opened Neapolitan pizza base. Look for: even thin centre, raised cornicione ring of 1-2cm, circular shape, no tears or holes. The centre should be translucent when held to light. Thick centre with no cornicione = not opened enough. Tears = too aggressive.`;
      }
      if (isRoman(styleKey)) {
        return `${base} You are reviewing Roman-style (teglia) pizza dough pressed into the pan. Look for: even coverage to all corners, consistent thickness around 1-1.5cm, dimpled surface from fingertip pressing. Thin spots at corners mean not stretched enough.`;
      }
      if (isPan(styleKey)) {
        return `${base} You are reviewing pan pizza dough in its pan. Look for: even coverage to all edges, slight thickness (2cm), surface ready for topping. Oil pooling around edges is correct. Uneven thickness means press again before topping.`;
      }
      return `${base} You are reviewing an opened pizza base. Look for: even thickness, defined crust edge, no tears. Assess whether it is ready to receive toppings.`;

    case 'topping_check': {
      const pizzaCtx = pizzaName ? ` This is a ${pizzaName}.` : '';
      const ovenCtx  = ovenType === 'pizza_oven' || ovenType === 'electric_pizza'
        ? ' The oven reaches 400-500°C — delicate toppings like fresh basil or prosciutto must go on after baking.'
        : ' The oven reaches around 250-280°C.';
      return `${base} You are reviewing a topped pizza before it goes in the oven.${pizzaCtx}${ovenCtx} Assess: topping distribution (even coverage, no overloaded clusters), cheese coverage, sauce ratio. Flag anything that will burn at this oven temperature or cause sogginess.`;
    }

    case 'proof':
      return `${base} You are assessing dough during final proof. Under-proofed: dense, springy, snaps back immediately when poked. Over-proofed: very puffy, slack, doesn't hold shape, deflates when poked. Well-proofed: slightly puffy, slow gentle spring-back when poked.`;

    case 'score':
      if (isBaguette(styleKey)) {
        return `${base} You are reviewing scored baguettes before baking. Look for: 5-7 diagonal cuts at 30-45 degrees, overlapping slightly, consistent depth of 5-7mm. Too shallow = won't open. Too deep = collapses. Cuts should be swift and decisive.`;
      }
      if (isBoule(styleKey)) {
        return `${base} You are reviewing a scored boule or country loaf before baking. Look for: clean decisive cuts, consistent depth, the pattern (cross, leaf, or single slash) should be centred on the dome. Jagged cuts suggest the blade dragged — next time use a swift single motion.`;
      }
      return `${base} You are reviewing scored bread dough before baking. Assess cut depth (5-7mm ideal), cleanliness of the cut, and pattern placement. Identify any cuts likely to cause blowouts or uneven oven spring.`;

    case 'bake':
      if (isNeapolitan(styleKey)) {
        return `${base} You are reviewing a baked Neapolitan pizza. Look for: leoparding (dark irregular spots) on the cornicione, fully cooked cheese without burning, even colour. A pale cornicione means too low temperature or not enough time. Black spots are good; fully black patches are too much.`;
      }
      if (isBaguette(styleKey)) {
        return `${base} You are reviewing baked baguettes. Look for: deep golden to amber crust colour, ears that have opened along the score lines, blistered surface. Pale = under-baked. Ears that didn't open = under-scored or under-proofed.`;
      }
      if (isBoule(styleKey) || isBread(styleKey)) {
        return `${base} You are reviewing a baked boule or country loaf. Look for: deep brown crust, ears or bloom from the score that opened well, hollow sound when tapped. Pale crust = needs more time. Good bloom indicates well-proofed and well-scored dough.`;
      }
      return `${base} You are reviewing a finished bake. Assess crust colour, structure, and overall result. Mention one thing that genuinely worked. Give one specific actionable thing to try differently next time. Remember you cannot assess crumb structure, taste, or texture from a photo — be humble about what the crust alone can tell you.`;

    case 'pizza_maestro': {
      const pizzaCtx = pizzaName ? `Pizza name: ${pizzaName}.` : '';

      const ovenCtx = (() => {
        if (ovenType === 'pizza_oven') return 'Wood or gas pizza oven at 450–500°C. Bake time 60–90 seconds. At this temperature, leoparding (irregular dark spots) on the cornicione is expected and correct — it is not a fault.';
        if (ovenType === 'electric_pizza') return 'Electric pizza oven at 350–420°C. Bake time 3–5 minutes. Some colour on the cornicione expected, light leoparding possible.';
        if (ovenType === 'home_oven_steel') return 'Home oven with steel or stone at 250–280°C. Bake time 5–8 minutes. Even golden-brown crust expected. No leoparding at this temperature — uniform golden colour is correct.';
        return 'Standard home oven at 220–260°C. Bake time 8–12 minutes. Even golden-brown crust expected.';
      })();

      const ingredientCtx = (() => {
        const parts: string[] = [];
        if (beforeBake && beforeBake.length > 0)
          parts.push(`BEFORE-BAKE INGREDIENTS for this specific pizza (should be visible and cooked on a baked pizza): ${beforeBake.join(', ')}.`);
        if (afterBake && afterBake.length > 0)
          parts.push(`AFTER-BAKE INGREDIENTS for this specific pizza (added by the baker after baking): ${afterBake.join(', ')}. On a BAKED pizza these should be visible, fresh, and uncooked-looking. If absent → baker forgot to add them after baking. If they look wilted, charred, or cooked → they were accidentally baked and should have been added after. On a TOPPED (pre-bake) pizza → correctly absent, do not flag as missing.`);
        return parts.join('\n');
      })();

      const styleCtx = (() => {
        if (styleKey === 'neapolitan') return `
NEAPOLITAN STANDARDS:
- Shape: Round ~28–32cm. Cornicione (crust edge) 1–2cm wide, clearly raised and puffy with visible air pockets. Centre thin ~3–4mm. Missing or flat cornicione, oval shape, uneven thickness, holes, tears = faults.
- Cornicione cooking at 450–500°C: Leoparding = irregular dark brown/black spots on an otherwise golden/tan crust. This is CORRECT and desirable. Do NOT call it burnt. A pale completely white/cream cornicione with zero spots = undercooked. Uniformly black everywhere (not just spots) = overcooked.
- Centre: Should be thin, lightly blistered, cooked through. Pale wet-looking heavy centre = undercooked.
- Cheese (fior di latte/mozzarella): Melted with some golden patches = correct. Completely white and unmelted = undercooked. Uniformly dark brown everywhere = overcooked.
- Undercooked signs (most important to catch): pale white cornicione with no spots, heavy unlifted centre, white unmelted cheese, dough looks raw and dense.`;
        if (styleKey === 'newyork') return `
NEW YORK STANDARDS:
- Shape: Large round ~35–40cm, hand-tossed. Crust edge 2–3cm. Should make wide foldable slices. Thick uneven stretch or missing crust = faults.
- Crust: Even golden-brown to amber. Some char acceptable. Pale = undercooked. Uniformly very dark = overcooked.
- Cheese: Low-moisture mozzarella fully melted and golden-brown in patches. White unmelted clumps = undercooked.
- Pepperoni: Should show curled edges and slight crisp.`;
        if (styleKey === 'roman' || styleKey === 'pizza_romana') return `
ROMAN STANDARDS:
- Teglia: Rectangular, fills the pan to all four corners evenly. Thickness ~2cm. Dimpled surface. Edges crispy and golden. Uncovered corners or uneven thickness = faults.
- Tonda Romana: Very thin, cracker-like throughout. Almost no raised cornicione. Rolled with pin. Uniformly thin and crisp — no soft patches.
- Cooking: Even golden-brown. Pale patches = undercooked.`;
        if (styleKey === 'pan') return `
PAN / DETROIT STANDARDS:
- Shape: Rectangular or square. Thick focaccia-like base ~3cm. Fills pan completely to all corners. No thin corners.
- Signature frico: Crispy caramelised cheese crust on the sides of the pan. Absent = undercooked or not enough cheese at edges.
- Top: Cheese fully melted and golden. Interior should be fluffy and airy, not dense.
- Detroit: Sauce typically applied on top of cheese (reverse build).`;
        return `
GENERAL PIZZA STANDARDS:
- Shape: Round and evenly stretched. Flag uneven thickness, tears, missing or flat crust edge, oval shape.
- Cooking: Crust golden to amber. Cheese fully melted. Undercooked = pale raw-looking, white unmelted cheese.
- Toppings: Even distribution. No large bare patches or overloaded clusters.`;
      })();

      return `You are an expert pizzaiolo and cooking teacher with 20 years of experience. You are looking at a photo to give precise, honest, actionable feedback to a home baker.

${pizzaCtx}
OVEN: ${ovenCtx}
${ingredientCtx}

${styleCtx}

━━━ STEP 1: IDENTIFY THE STAGE ━━━
Look at the photo and determine which stage it shows. Use these visual cues:
- BASE: bare dough only, no sauce or toppings visible
- TOPPED: sauce and/or cheese visible, crust edge is still pale and raw-coloured, no baking colour
- BAKED: crust has heat colour (golden/brown/char spots), cheese has melted and changed texture

━━━ STEP 2: ASSESS BY STAGE ━━━

IF BASE — assess in order:
1. Shape: Is it round? Even thickness across the whole base? Cornicione edge clearly defined? Any tears or holes?
2. Stretch quality: Even? Thick heavy centre? Thin spots that risk burning or tearing in the oven?
3. Size: Appropriate for the style?

IF TOPPED — assess in order:
1. Topping distribution: Even coverage? Overloaded in the centre? Large bare patches?
2. Sauce: Right amount? Too close to the edge (will burn)?
3. Cheese: Good coverage? Overhanging the edge?
4. Before-bake ingredients: Are all the expected ones present? Anything missing?
5. After-bake ingredients: Are any accidentally placed before baking? They will burn, wilt, or lose texture — flag this.
6. Any ingredients likely to cause sogginess (very wet toppings not drained)?

IF BAKED — assess ALL of the following in order:
1. SHAPE: Round? Cornicione even all around? Any side missing crust? Holes or folds visible?
2. CORNICIONE/CRUST COLOUR: Apply oven-appropriate standards above. Undercooked is the most common mistake — check carefully.
3. CENTRE: Cooked through? Pale wet heavy centre = undercooked. Thin blistered = correct.
4. CHEESE: Melted state and colour. Unmelted white = undercooked. Golden patches = correct. Uniformly dark = overcooked.
5. BEFORE-BAKE TOPPINGS: Look carefully at each ingredient. Are they present? Properly cooked?
   CRITICAL — ingredient identification: look carefully before naming anything.
   - Purple round items: could be olives, grapes, figs, or capers — check size and texture
   - Small round red/orange items: likely cherry tomatoes — check if they have split/caramelised (cooked) or are still raw
   - Thin pale slices: could be potato, pear, onion, or fennel — use the recipe ingredient list above as your reference; if the recipe says pear, look for pear
   - White chunks: could be mozzarella, ricotta, burrata, or potato — check context
   - If you genuinely cannot identify something, describe what you see rather than guessing
6. AFTER-BAKE TOPPINGS: Check each after-bake ingredient listed above.
   - Present and fresh/uncooked-looking = correct
   - Absent = baker forgot to add after baking → mention gently as a finishing step
   - Wilted, charred, or cooked-looking = accidentally baked → flag this specifically
7. COMMON ROOKIE MISTAKES — check each one:
   - Undercooked overall (pale crust, unmelted cheese, heavy centre) — most important to catch
   - Overloaded toppings (piled too high, won't cook evenly, causes sogginess)
   - Under-topped (large bare dough patches)
   - Holes or tears in the base
   - Not round / poorly stretched
   - Uneven thickness (thick one side, thin the other)
   - Cornicione flat or missing on one or more sides
   - Sauce too close to the edge
   - Cheese overhanging the edge
   - After-bake ingredients accidentally baked (wilted basil, cooked prosciutto)

━━━ OUTPUT FORMAT — STRICT ━━━
Line 1: Stage + short verdict, e.g. "Baked — solid bake" or "Topped — one fix before the oven"
Line 2: "✓ " + the one specific thing done well (under 15 words)
Line 3: "→ " + the single most important improvement, specific and actionable (under 20 words)
Line 4 (only if truly important): "→ " + one more improvement (under 20 words)
Four lines maximum. No paragraphs. Every line stands alone.


TONE:
Write like a knowledgeable friend who has baked a thousand pizzas and genuinely wants you to improve. Be honest — do not soften real problems or invent praise that isn't warranted. Be warm but never effusive — avoid "great job", "amazing", "perfect". Acknowledge genuine effort briefly. For clear issues (pale crust, unmelted cheese, obvious shape problems) be direct. For ambiguous things (colour that could be correct or slightly off, ingredients you're not 100% sure about) be appropriately measured — say "looks like it could use a bit more time" rather than "this is undercooked". Remember you are reading a photo, not tasting the pizza — show appropriate humility about what you cannot fully assess from an image. End with one specific actionable encouragement for next time.

STRICT RULES:
- Never say "I can see", "the image shows", or "in this photo"
- Never give generic advice — anchor everything to what you actually see
- Never guess an ingredient name if unsure — describe what you see instead
- Do not praise something you cannot actually verify from the image
- Follow the OUTPUT FORMAT above exactly — four short lines maximum
- If locale is French, reply entirely in French`;
    }

    default:
      return `${base} Assess this dough or bake and give actionable feedback.`;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mimeType, stepId, styleKey, kitchenTemp, prefermentType, locale, ovenType, pizzaName, beforeBake, afterBake, question, stepTitle, recipeContext } =
      await req.json();

    if (!stepId || (!imageBase64 && !question)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const model0 = process.env.ANTHROPIC_VISION_MODEL ?? 'claude-haiku-4-5-20251001';

    // ── Text-only coach: baker asks a question about the current step ──
    if (!imageBase64 && question) {
      const q = String(question).slice(0, 500);
      const ovenCtx = ovenType === 'pizza_oven' ? 'wood/gas pizza oven 450–500°C'
        : ovenType === 'electric_pizza' ? 'electric pizza oven 350–420°C'
        : ovenType === 'home_oven_steel' ? 'home oven with steel/stone 250–280°C'
        : ovenType ? 'standard home oven 220–260°C' : '';
      const recipeCtx = typeof recipeContext === 'string' && recipeContext.trim()
        ? `\n${String(recipeContext).slice(0, 800)}`
        : '';
      const sys = `You are an expert bread and pizza coach answering a home baker's question mid-bake. They are currently at the "${stepTitle ?? stepId}" step of their plan.
Context: style ${styleKey || 'unknown'}${ovenCtx ? `, oven: ${ovenCtx}` : ''}${kitchenTemp ? `, kitchen ${kitchenTemp}°C` : ''}${prefermentType && prefermentType !== 'none' ? `, preferment: ${prefermentType}` : ''}.${recipeCtx}
${APP_PHILOSOPHY}\nRules: answer in 2–4 sentences maximum, direct and actionable, anchored to their context. Be honest about uncertainty. Never invent measurements they didn't give. When the baker questions a value that appears in the recipe context above (e.g. a small yeast amount), do NOT contradict it — explain why the app's number is right for their specific schedule, then reassure. No greetings, no sign-off.${locale === 'fr' ? ' Reply entirely in French.' : ''}`;
      const r = await client.messages.create({
        model: model0,
        max_tokens: 400,
        system: sys,
        messages: [{ role: 'user', content: q }],
      });
      const answer = r.content.filter(b => b.type === 'text').map(b => (b as { type: 'text'; text: string }).text).join('');
      return NextResponse.json({ feedback: answer });
    }

    const systemPrompt = buildSystemPrompt(stepId, styleKey ?? '', ovenType, pizzaName, beforeBake, afterBake);

    const contextParts: string[] = [];
    if (kitchenTemp) contextParts.push(`Kitchen: ${kitchenTemp}°C`);
    if (prefermentType && prefermentType !== 'none') contextParts.push(`Preferment: ${prefermentType}`);
    if (locale === 'fr') contextParts.push('Reply in French.');
    const contextLine = contextParts.join('. ');

    const model = process.env.ANTHROPIC_VISION_MODEL ?? 'claude-haiku-4-5-20251001';

    const response = await client.messages.create({
      model,
      max_tokens: stepId === 'pizza_maestro' ? 450 : 200,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: (mimeType as 'image/jpeg' | 'image/png' | 'image/webp') ?? 'image/jpeg',
              data: imageBase64,
            },
          },
          { type: 'text', text: contextLine || 'Please assess this.' },
        ],
      }],
    });

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('');

    return NextResponse.json({ feedback: text });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('bake-coach error:', msg);
    return NextResponse.json(
      { error: 'Coach unavailable right now. Please try again.', detail: msg },
      { status: 500 },
    );
  }
}
