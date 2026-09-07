"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { homePathForRole } from "@/server/session";
import { describeError, fail, ok, type ActionResult } from "./result";

const credentials = z.object({
  email: z.string().trim().min(1, "Enter your email address.").email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export async function signInAction(
  _prev: ActionResult<{ redirectTo: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check your details.");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // Never leak whether the address exists.
    return fail(
      error.message.toLowerCase().includes("invalid")
        ? "That email and password don't match. Please try again."
        : describeError(error),
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profile && !profile.is_active) {
    await supabase.auth.signOut();
    return fail("This account has been deactivated. Please contact your school office.");
  }

  const requested = String(formData.get("next") ?? "").trim();
  const safeNext = requested.startsWith("/") && !requested.startsWith("//") ? requested : null;

  revalidatePath("/", "layout");
  return ok({ redirectTo: safeNext ?? homePathForRole(profile?.role ?? "parent") });
}

export async function signOutAction(): Promise<ActionResult> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  return ok();
}

export async function sendPasswordResetAction(
  _prev: ActionResult<{ sent: true }> | null,
  formData: FormData,
): Promise<ActionResult<{ sent: true }>> {
  const email = String(formData.get("email") ?? "").trim();
  const parsed = z.string().email().safeParse(email);
  if (!parsed.success) return fail("Enter a valid email address.");

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${publicEnv.siteUrl}/auth/callback?next=/account`,
  });

  // Respond identically whether or not the address is registered.
  if (error && !error.message.toLowerCase().includes("not found")) {
    return fail(describeError(error));
  }

  return ok({ sent: true });
}

export async function updatePasswordAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) return fail("Choose a password of at least 8 characters.");
  if (password !== confirm) return fail("The two passwords don't match.");

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return fail(describeError(error));

  return ok();
}
