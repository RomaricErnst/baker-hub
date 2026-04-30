import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

function buildSystemPrompt(stepId: string, styleKey: string, ovenType?: string, pizzaName?: string): string {
  const base = `You are an expert bread and pizza coach. Reply in 2-3 sentences maximum. Be direct and actionable. Never say "I can see" or "the image shows". Never mention the photo.`;

  switch (stepId) {

    case 'poolish':
      return `${base} You are reviewing a poolish (liquid pre-ferment). Assess readiness: look for a domed or slightly domed surface, bubbles throughout, possible slight recession from peak. Flat = not ready. Collapsed or very wet = over-fermented.`;

    case 'biga':
      return `${base} You are reviewing a biga (stiff pre-ferment). Assess readiness: look for roughly doubled volume, holes and bubbles when broken, slight dome. Dense and unchanged = not ready yet.`;

    case 'starter':
      return `${base} You are reviewing a sourdough starter or levain. Assess readiness: look for a domed surface at or just past peak, bubbles throughout, volume doubled. Flat = needs more time. Collapsed = past peak.`;

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
      return `${base} You are reviewing dough after bulk fermentation. Assess readiness to shape: look for 50-80% volume increase, domed top, bubbles visible under the surface or on sides, slight jiggle when the container is moved. Flat with no bubbles = needs more time. Overly slack and very jiggly = over-fermented.`;

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
      return `${base} You are reviewing a finished bake. Assess crust colour, structure, and overall result. Give honest feedback on what went well and one specific thing to try next time.`;

    case 'pizza_maestro': {
      const pizzaCtx = pizzaName ? ` This is a ${pizzaName}.` : '';
      const ovenCtx  = ovenType === 'pizza_oven' || ovenType === 'electric_pizza'
        ? ' Oven reaches 400-500°C.'
        : ' Oven reaches around 250-280°C.';
      return `${base} You are an expert pizzaiolo.${pizzaCtx}${ovenCtx} Look at this photo and identify which stage you see: 1. Opened dough base before toppings — assess stretch, thickness, cornicione. 2. Topped pizza ready to bake — assess topping distribution, coverage, any issues. 3. Baked pizza — assess crust colour, leoparding, cheese melt, overall result. Start your response by identifying the stage in one word (Base / Topped / Baked), then give 2-3 sentences of specific feedback.`;
    }

    default:
      return `${base} Assess this dough or bake and give actionable feedback.`;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mimeType, stepId, styleKey, kitchenTemp, prefermentType, locale, ovenType, pizzaName } =
      await req.json();

    if (!imageBase64 || !stepId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const systemPrompt = buildSystemPrompt(stepId, styleKey ?? '', ovenType, pizzaName);

    const contextParts: string[] = [];
    if (kitchenTemp) contextParts.push(`Kitchen: ${kitchenTemp}°C`);
    if (prefermentType && prefermentType !== 'none') contextParts.push(`Preferment: ${prefermentType}`);
    if (locale === 'fr') contextParts.push('Reply in French.');
    const contextLine = contextParts.join('. ');

    const model = process.env.ANTHROPIC_VISION_MODEL ?? 'claude-haiku-4-5';

    const response = await client.messages.create({
      model,
      max_tokens: 200,
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
  } catch (err) {
    console.error('bake-coach error:', err);
    return NextResponse.json(
      { error: 'Coach unavailable right now. Please try again.' },
      { status: 500 },
    );
  }
}
