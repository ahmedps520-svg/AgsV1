import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";

/**
 * Refreshes the Supabase session on every request and keeps unauthenticated
 * visitors out of the app. Fine-grained role checks live in the layouts, which
 * already load the caller's profile.
 *
 * (Next.js 16 renamed `middleware.ts` to `proxy.ts`; the contract is the same.)
 */
const PUBLIC_PATHS = ["/", "/login", "/auth", "/offline", "/manifest.webmanifest", "/sw.js"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export default async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });

  // Without Supabase credentials the app renders a setup screen instead of
  // crashing every request in the proxy.
  if (!isSupabaseConfigured()) return response;

  const supabase = createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // getClaims()/getUser() must be called to actually refresh the token.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    redirect.search = "";
    redirect.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(redirect);
  }

  if (user && pathname === "/login") {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/";
    redirect.search = "";
    return NextResponse.redirect(redirect);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except Next.js internals and static assets — the session
     * cookie only needs refreshing on requests that render or mutate.
     */
    "/((?!_next/static|_next/image|favicon.ico|icons/|sw.js|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
