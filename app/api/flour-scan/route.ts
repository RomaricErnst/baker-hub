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

KNOWN FLOUR DATABASE (authoritative — always use these values if brand matches):
${dbSummary}

If the bag matches any entry above, return those exact values with confidence "high" and source "database".
If not found in database, estimate from flour type with confidence "medium" and source "estimated".
Never return an error — always return your best estimate.

Respond ONLY with a JSON object, no other text:
{
  "name": "brand and product name",
  "w": number,
  "protein": number,
  "confidence": "high" | "medium" | "low",
  "source": "database" | "estimated",
  "note": "brief note if W was estimated"
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
