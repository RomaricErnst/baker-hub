import { NextResponse } from 'next/server';
import { FLOUR_DB } from '@/lib/flourDatabase';
import { guardModelCall, issueAskToken, pageIdOf, readJsonCapped, sameOrigin } from '../../lib/apiGuard';

// Abuse guard (round 18, M4): per-IP rate limit and an image of at most 5 MB.
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
// The model call usually takes about 5 s; Vercel's default (300 s) is far above it.
export const maxDuration = 30;
const MAX_BODY = Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 4096;

/** The page's ask token (round 20): fetched before a call, bound to the page's random id (round 23). */
export async function GET(request: Request) {
  const page = pageIdOf(request.headers);
  if (!sameOrigin(request.headers) || !page) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return NextResponse.json({ token: issueAskToken('flour-scan', page) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const guard = await guardModelCall('flour-scan', request.headers);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.status === 429 ? 'Too many scans. Please try again in a few minutes.' : 'Forbidden' }, { status: guard.status });
  }
  const read = await readJsonCapped(request, MAX_BODY);
  if (!read.ok) return NextResponse.json({ error: read.status === 413 ? 'Please use an image under 5 MB.' : 'Invalid request' }, { status: read.status });
  const { base64, mediaType } = (read.body ?? {}) as { base64?: unknown; mediaType?: unknown };

  if (typeof base64 !== 'string' || !base64 || typeof mediaType !== 'string' || !mediaType) {
    return NextResponse.json({ error: 'Missing base64 or mediaType' }, { status: 400 });
  }
  if (Math.floor(base64.replace(/=+$/, '').length * 3 / 4) > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: 'Please use an image under 5 MB.' }, { status: 413 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  const dbSummary = FLOUR_DB
    .filter(f => f.brand.length > 0)
    .map(f => `${f.brand} ${f.name}: W${f.w}, ${f.protein}% protein${f.wPublished ? '' : ' (W estimated)'}`)
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
- Protein printed on the bag (g per 100 g in the nutrition table) is copied exactly, decimals included (11.5 stays 11.5).

RESPONSE FORMAT — always return this exact JSON, no other text:
{
  "name": "brand and product name as shown on bag, or best guess",
  "w": <positive number, never null or 0>,
  "protein": <number between 8 and 16>,
  "wOnBag": <true only when the W value is printed on this bag>,
  "proteinOnBag": <true only when the protein is printed on this bag>,
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

  const data = await response.json().catch(() => ({}));

  // Round 20 (9): the browser gets the reading only, never the provider's message (model id, message id,
  // token usage, error text).
  if (!response.ok) {
    console.error('flour-scan provider error:', response.status, data?.error?.type ?? '');
    return NextResponse.json({ error: 'Scan unavailable right now.' }, { status: response.status === 429 ? 429 : 502 });
  }
  const text = typeof data?.content?.[0]?.text === 'string' ? data.content[0].text as string : '';
  const result = scanReading(text);
  if (!result) {
    console.error('flour-scan: no reading in the response');
    return NextResponse.json({ error: 'Could not read the bag.' }, { status: 502 });
  }
  return NextResponse.json({ result });
}

export interface FlourReading {
  name: string; w: number; protein: number; wOnBag: boolean; proteinOnBag: boolean;
  readability: string; confidence: string; source: 'database' | 'estimated'; note: string;
}

/** The model's JSON, reduced to the fields the scanner shows. Don't trust its self-reported
 *  source: 'database': it labelled anything from a recognised brand as matched even when the product
 *  is not in FLOUR_DB, so a match needs both the brand and the product name. Null when unreadable. */
export function scanReading(text: string): FlourReading | null {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(jsonMatch[0]); } catch { return null; }
  const name = String(parsed.name ?? '').slice(0, 160);
  const claimed = name.toLowerCase();
  const isRealMatch = FLOUR_DB.some(f => {
    const brand = f.brand.toLowerCase();
    return brand.length > 0 && claimed.includes(brand) && claimed.includes(f.name.toLowerCase());
  });
  const w = Number(parsed.w);
  const protein = Number(parsed.protein);
  return {
    name,
    w: Number.isFinite(w) ? Math.round(w) : NaN,
    protein: Number.isFinite(protein) ? Math.round(protein * 10) / 10 : NaN,
    wOnBag: parsed.wOnBag === true,
    proteinOnBag: parsed.proteinOnBag === true,
    readability: String(parsed.readability ?? 'partial'),
    confidence: String(parsed.confidence ?? 'medium'),
    source: parsed.source === 'database' && isRealMatch ? 'database' : 'estimated',
    note: String(parsed.note ?? '').slice(0, 400),
  };
}
