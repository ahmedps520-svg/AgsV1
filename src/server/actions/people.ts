"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasServiceRoleKey, publicEnv } from "@/lib/env";
import { getSession, type Session } from "@/server/session";
import type { UserRole } from "@/lib/types/database";
import { describeError, fail, ok, type ActionResult } from "./result";

type AdminGuard =
  | { ok: false; error: string }
  | { ok: true; session: Session; schoolId: string };

async function adminSession(): Promise<AdminGuard> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Your session has expired. Please sign in again." };
  if (session.profile.role !== "admin") {
    return { ok: false, error: "Only school administrators can manage accounts." };
  }
  if (!session.profile.school_id) {
    return { ok: false, error: "Your account is not linked to a school yet." };
  }
  return { ok: true, session, schoolId: session.profile.school_id };
}

const ROLES = ["admin", "staff", "parent", "display"] as const;

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  full_name: z.string().trim().min(1, "Enter a full name.").max(120),
  role: z.enum(ROLES),
  phone: z.string().trim().max(40).optional(),
  vehicle_description: z.string().trim().max(120).optional(),
  send_invite: z.boolean().default(false),
});

/** Generates a readable one-time password an office can hand over verbally. */
function temporaryPassword(): string {
  const words = ["Bright", "Falcon", "Harbor", "Lantern", "Meadow", "Orchard", "Summit", "Willow"];
  const bytes = new Uint32Array(3);
  crypto.getRandomValues(bytes);
  const word = words[bytes[0] % words.length];
  const digits = String(bytes[1] % 10000).padStart(4, "0");
  return `${word}-${digits}-${(bytes[2] % 26 + 10).toString(36).toUpperCase()}`;
}

/**
 * Creates a login for a member of the school community.
 *
 * Uses the service-role key, so it is gated behind an explicit administrator
 * check above — the browser never sees that key.
 */
export async function createAccountAction(
  _prev: ActionResult<{ email: string; password?: string; invited: boolean }> | null,
  formData: FormData,
): Promise<ActionResult<{ email: string; password?: string; invited: boolean }>> {
  const guard = await adminSession();
  if (!guard.ok) return fail(guard.error);

  if (!hasServiceRoleKey()) {
    return fail(
      "Account creation needs SUPABASE_SERVICE_ROLE_KEY to be set on the server. See DEPLOYMENT.md.",
    );
  }

  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    full_name: formData.get("full_name"),
    role: formData.get("role"),
    phone: formData.get("phone") ?? undefined,
    vehicle_description: formData.get("vehicle_description") ?? undefined,
    send_invite: formData.get("send_invite") === "on",
  });

  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the details.");

  const { email, full_name, role, phone, vehicle_description, send_invite } = parsed.data;
  const admin = createAdminClient();

  const metadata = {
    full_name,
    role: role as UserRole,
    school_id: guard.schoolId,
    phone: phone ?? null,
  };

  try {
    if (send_invite) {
      const { error } = await admin.auth.admin.inviteUserByEmail(email, {
        data: metadata,
        redirectTo: `${publicEnv.siteUrl}/auth/callback?next=/account`,
      });
      if (error) return fail(describeError(error));
    } else {
      const password = temporaryPassword();
      const { error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: metadata,
      });
      if (error) return fail(describeError(error));

      await syncProfile(email, guard.schoolId, { full_name, role, phone, vehicle_description });
      revalidatePath("/people");
      return ok({ email, password, invited: false });
    }

    await syncProfile(email, guard.schoolId, { full_name, role, phone, vehicle_description });
    revalidatePath("/people");
    return ok({ email, invited: true });
  } catch (error) {
    return fail(describeError(error));
  }
}

/**
 * The `handle_new_user` trigger creates the profile row; this fills in the
 * fields that only the administrator form knows about.
 */
async function syncProfile(
  email: string,
  schoolId: string,
  fields: { full_name: string; role: UserRole; phone?: string; vehicle_description?: string },
) {
  const admin = createAdminClient();
  await admin
    .from("profiles")
    .update({
      school_id: schoolId,
      role: fields.role,
      full_name: fields.full_name,
      phone: fields.phone || null,
      vehicle_description: fields.vehicle_description || null,
    })
    .eq("email", email);
}

/* ------------------------------------------------------- profile updates -- */

export async function updatePersonAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const guard = await adminSession();
  if (!guard.ok) return fail(guard.error);

  const parsed = z
    .object({
      id: z.string().uuid(),
      full_name: z.string().trim().min(1, "Enter a full name.").max(120),
      role: z.enum(ROLES),
      phone: z.string().trim().max(40).optional(),
      vehicle_description: z.string().trim().max(120).optional(),
      is_active: z.boolean(),
    })
    .safeParse({
      id: formData.get("id"),
      full_name: formData.get("full_name"),
      role: formData.get("role"),
      phone: formData.get("phone") ?? undefined,
      vehicle_description: formData.get("vehicle_description") ?? undefined,
      is_active: formData.get("is_active") !== "false",
    });

  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the details.");

  if (parsed.data.id === guard.session.userId && parsed.data.role !== "admin") {
    return fail("You cannot remove your own administrator access.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.full_name,
      role: parsed.data.role,
      phone: parsed.data.phone || null,
      vehicle_description: parsed.data.vehicle_description || null,
      is_active: parsed.data.is_active,
    })
    .eq("id", parsed.data.id)
    .eq("school_id", guard.schoolId);

  if (error) return fail(describeError(error));

  revalidatePath("/people");
  return ok();
}

/* --------------------------------------------------- pickup permissions -- */

export async function linkGuardianAction(input: {
  studentId: string;
  profileId: string;
  relationship?: string;
  isPrimary?: boolean;
}): Promise<ActionResult> {
  const guard = await adminSession();
  if (!guard.ok) return fail(guard.error);

  const parsed = z
    .object({
      studentId: z.string().uuid(),
      profileId: z.string().uuid(),
      relationship: z.string().trim().max(60).optional(),
      isPrimary: z.boolean().optional(),
    })
    .safeParse(input);

  if (!parsed.success) return fail("Choose a student and a guardian.");

  const supabase = await createClient();
  const { error } = await supabase.from("guardians").upsert(
    {
      student_id: parsed.data.studentId,
      profile_id: parsed.data.profileId,
      relationship: parsed.data.relationship || "Guardian",
      is_primary: parsed.data.isPrimary ?? false,
      can_pickup: true,
    },
    { onConflict: "student_id,profile_id" },
  );

  if (error) return fail(describeError(error));

  revalidatePath("/people");
  revalidatePath("/students");
  return ok();
}

export async function setGuardianPickupAction(input: {
  guardianId: string;
  canPickup: boolean;
}): Promise<ActionResult> {
  const guard = await adminSession();
  if (!guard.ok) return fail(guard.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from("guardians")
    .update({ can_pickup: input.canPickup })
    .eq("id", input.guardianId);

  if (error) return fail(describeError(error));

  revalidatePath("/people");
  revalidatePath("/students");
  return ok();
}

export async function unlinkGuardianAction(guardianId: string): Promise<ActionResult> {
  const guard = await adminSession();
  if (!guard.ok) return fail(guard.error);

  const supabase = await createClient();
  const { error } = await supabase.from("guardians").delete().eq("id", guardianId);
  if (error) return fail(describeError(error));

  revalidatePath("/people");
  revalidatePath("/students");
  return ok();
}
