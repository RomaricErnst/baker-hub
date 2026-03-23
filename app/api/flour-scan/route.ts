import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { base64, mediaType } = await request.json();

  if (!base64 || !mediaType) {
    return NextResponse.json({ error: 'Missing base64 or mediaType' }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
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
            text: `You are analyzing a flour bag image for a pizza dough calculator app.
Extract the following information from the flour bag:
1. Flour name/brand and product name
2. W value (strength rating) — look for "W" followed by a number, or "forza" value
3. Protein percentage — look for "proteine" or "protein" in the nutritional table (per 100g)

If W value is not visible, estimate based on:
- "00 pizzeria" type flours: estimate W 260
- "00 cuoco/chef" type flours: estimate W 300
- "manitoba" type flours: estimate W 350+
- "bread flour" type: estimate W 200
- "all purpose/T55" type: estimate W 130

Respond ONLY with a JSON object, no other text:
{
  "name": "brand and product name",
  "w": number,
  "protein": number,
  "confidence": "high" | "medium" | "low",
  "note": "brief note if W was estimated"
}`,
          },
        ],
      }],
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    return NextResponse.json({ error: data.error?.message ?? 'Anthropic API error' }, { status: response.status });
  }

  return NextResponse.json(data);
}
