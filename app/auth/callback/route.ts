import { createServerSupabaseClient } from '@/app/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    // A failed exchange used to redirect home silently, leaving the baker
    // signed out with nothing to read. Carry the fact; a later change can
    // surface it.
    if (error) return NextResponse.redirect(`${origin}/?authError=1`);
  }

  return NextResponse.redirect(`${origin}/`);
}
