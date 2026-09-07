import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession, homePathForRole } from "@/server/session";

/**
 * Exchanges an email link (invite, password reset, magic link) for a session
 * cookie, then sends the user to the right home screen for their role.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const requestedNext = searchParams.get("next");
  const next = requestedNext?.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : null;

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=callback`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=callback`);
  }

  if (next) return NextResponse.redirect(`${origin}${next}`);

  const session = await getSession();
  return NextResponse.redirect(
    `${origin}${session ? homePathForRole(session.profile.role) : "/login"}`,
  );
}
