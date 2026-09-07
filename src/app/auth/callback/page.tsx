"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { IS_DEMO } from "@/lib/api/config";
import { BootScreen } from "@/components/boot-screen";
import { ErrorMessage } from "@/components/ui/primitives";

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<BootScreen label="Signing you in…" />}>
      <Callback />
    </Suspense>
  );
}

/**
 * Landing spot for invitation and password-reset emails.
 * Exchanges the one-time code for a session, then sends the user on to set a
 * password from their account page.
 */
function Callback() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (IS_DEMO) {
      router.replace("/login");
      return;
    }

    const code = params.get("code");
    const supabase = createClient();

    (async () => {
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          setError("That sign-in link has expired. Request a new one from the sign-in page.");
          return;
        }
      } else {
        // Implicit-flow links carry the session in the URL hash; the client
        // picks that up on its own, so just confirm we have a user.
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setError("That sign-in link has expired. Request a new one from the sign-in page.");
          return;
        }
      }

      router.replace("/account");
    })();
  }, [params, router]);

  if (error) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6">
        <ErrorMessage>{error}</ErrorMessage>
      </main>
    );
  }

  return <BootScreen label="Signing you in…" />;
}
