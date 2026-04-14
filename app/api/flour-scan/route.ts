import { NextResponse } from 'next/server';
import { FLOUR_DB } from '@/lib/flourDatabase';

export async function POST(request: Request) {
  const { base64, mediaType } = await request.json();

  if (!base64 || !mediaType) {
    return NextResponse.json({ error: 'Missing base64 or mediaType' }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  const dbSummary = FLOUR_DB
    .filter(f => f.wPublished)
    .map(f => `${f.brand} ${f.name}: W${f.w}, ${f.protein}% protein`)
    .join('\n');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_VISION_MODEL ?? 'claude-haiku-4-5',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          },
          {
            type: 'text',
            text: `You are analyzing a flour bag image for a pizza/bread dough calculator.

Your job: extract flour name, W value, and protein percentage.

READABILITY ASSESSMENT — set "readability" based on what you can see:
- "clear": bag is clearly visible, brand/name readable, at least one of W or protein visible
- "partial": bag visible but some info is unclear or missing — use estimates for missing values
- "unreadable": image is too blurry, dark, not a flour bag, or no useful information visible

KNOWN FLOUR DATABASE (use these exact values when brand matches):
${dbSummary}

ESTIMATION RULES when values are not visible:
- W value by flour type: Italian 00 strong=280, Italian 00 standard=220, French T45 forte=260,
  French T55/AP=180, French T65/bread=200, T80=170, T110 wholemeal=150, rye=130, Manitoba=350
- Protein: W280→13%, W220→11.5%, W180→10.5%, W200→11%, W350→14.5%

RESPONSE FORMAT — always return this exact JSON, no other text:
{
  "name": "brand and product name as shown on bag, or best guess",
  "w": <positive number, never null or 0>,
  "protein": <number between 8 and 16>,
  "confidence": "high" | "medium" | "low",
  "readability": "clear" | "partial" | "unreadable",
  "source": "database" | "estimated",
  "note": "what you could and could not read from the image"
}`,
          },
        ],
      }],
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('Anthropic API error:', data);
    return NextResponse.json(
      { error: data.error?.message ?? 'Anthropic API error' },
      { status: response.status }
    );
  }

  // Verify we got content back
  if (!data.content?.[0]?.text) {
    console.error('No content in response:', JSON.stringify(data));
    return NextResponse.json(
      { error: 'Empty response from AI' },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}
