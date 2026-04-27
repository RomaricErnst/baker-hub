import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const STEP_PROMPTS: Record<string, string> = {
  poolish: `You are an expert bread and pizza coach reviewing a photo of a poolish (pre-ferment).
Assess whether it is ready to use. Look for: domed or slightly domed surface, bubbles throughout,
possible slight recession from peak. A flat surface means not ready. Collapsed or very wet surface
means over-fermented. Be specific about what you see. Reply in 2-3 sentences maximum.
Be direct and actionable. Never say "I can see" or "the image shows".`,

  biga: `You are an expert bread and pizza coach reviewing a photo of a biga (stiff pre-ferment).
Assess whether it is ready to use. Look for: volume roughly doubled, holes and bubbles visible
when broken, slight dome. Reply in 2-3 sentences maximum. Be direct and actionable.`,

  starter: `You are an expert sourdough coach reviewing a photo of a sourdough starter or levain.
Assess whether it has peaked and is ready to use. Look for: domed surface at or just past peak,
bubbles throughout, volume doubled. A flat surface means not ready yet.
Reply in 2-3 sentences maximum. Be direct and actionable.`,

  mix: `You are an expert bread and pizza coach reviewing a photo of mixed dough.
Assess gluten development. Look for: smooth surface, elasticity, whether the dough holds its shape.
If this is a windowpane test photo, assess translucency and whether it stretches without tearing.
Reply in 2-3 sentences maximum. Be direct and actionable.`,

  bulk: `You are an expert bread and pizza coach reviewing a photo of dough after bulk fermentation.
Assess whether it is ready to shape. Look for: visible rise (typically 50-80%), domed top,
bubbles under the surface or on the sides. Jiggle and dome indicate good fermentation.
Reply in 2-3 sentences maximum. Be direct and actionable.`,

  shape: `You are an expert bread and pizza coach reviewing a photo of shaped dough.
Assess the shaping quality. Look for: smooth and taut surface, clean seam (if visible),
round and even form. Signs of poor shaping: torn surface, uneven shape, visible seams on top.
Reply in 2-3 sentences maximum. Be direct and actionable.`,

  proof: `You are an expert bread and pizza coach reviewing a photo of dough during final proof.
Assess whether it is properly proofed. Signs of under-proofing: dense, tight, springy.
Signs of over-proofing: very puffy, slack, doesn't hold shape, jiggles excessively.
Well-proofed: slightly puffy, holds shape, slow spring back when poked.
Reply in 2-3 sentences maximum. Be direct and actionable.`,

  bake: `You are an expert bread and pizza coach reviewing a photo of a finished bake.
For bread: assess crust colour, ear/bloom development, overall appearance.
For pizza: assess leoparding (charred spots on crust), cornicione colour, overall bake.
Give honest feedback on what went well and one thing to try next time if relevant.
Reply in 2-3 sentences maximum. Be direct and actionable.`,
};

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mimeType, stepId, styleKey, kitchenTemp, prefermentType, locale } =
      await req.json();

    if (!imageBase64 || !stepId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const systemPrompt = STEP_PROMPTS[stepId] ?? STEP_PROMPTS.bake;

    const contextParts: string[] = [];
    if (styleKey) contextParts.push(`Style: ${styleKey}`);
    if (kitchenTemp) contextParts.push(`Kitchen: ${kitchenTemp}°C`);
    if (prefermentType && prefermentType !== 'none') contextParts.push(`Preferment: ${prefermentType}`);
    if (locale === 'fr') contextParts.push('Reply in French.');
    const contextLine = contextParts.length > 0 ? contextParts.join('. ') + '.' : '';

    const model = process.env.ANTHROPIC_VISION_MODEL ?? 'claude-haiku-4-5';

    const response = await client.messages.create({
      model,
      max_tokens: 200,
      system: systemPrompt,
      messages: [
        {
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
            {
              type: 'text',
              text: contextLine || 'Please assess this photo.',
            },
          ],
        },
      ],
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
