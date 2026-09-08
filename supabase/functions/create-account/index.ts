/**
 * create-account — the only place the Supabase service-role key is allowed to
 * live.
 *
 * The app is a static site, so it can never hold a secret: anyone could read it
 * out of the JavaScript bundle. Account creation therefore happens here, on
 * Supabase's own infrastructure, and this function re-checks for itself that
 * the caller is a signed-in administrator of the school it is writing to.
 *
 * Deploy with:
 *   supabase functions deploy create-account
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ROLES = new Set(["admin", "staff", "parent"]);
const SCOPES = new Set(["boys", "girls", "mixed", "all"]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

/** A readable one-time password an office can hand over verbally. */
function temporaryPassword(): string {
  const words = ["Bright", "Falcon", "Harbor", "Lantern", "Meadow", "Orchard", "Summit", "Willow"];
  const bytes = new Uint32Array(3);
  crypto.getRandomValues(bytes);
  return `${words[bytes[0] % words.length]}-${String(bytes[1] % 10000).padStart(4, "0")}`;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (request.method !== "POST") return json({ error: "Use POST." }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authorization = request.headers.get("Authorization") ?? "";
  if (!authorization) return json({ error: "You must be signed in." }, 401);

  // 1. Who is calling? Read it with the caller's own token, never a trusted one.
  const asCaller = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
  });

  const {
    data: { user },
  } = await asCaller.auth.getUser();
  if (!user) return json({ error: "You must be signed in." }, 401);

  const { data: caller } = await asCaller
    .from("profiles")
    .select("role, school_id, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!caller?.is_active || caller.role !== "admin") {
    return json({ error: "Only a school administrator can create accounts." }, 403);
  }
  if (!caller.school_id) {
    return json({ error: "Your account is not linked to a school yet." }, 400);
  }

  // 2. Validate the request.
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Send a JSON body." }, 400);
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const fullName = String(body.full_name ?? "").trim();
  const role = String(body.role ?? "");
  const scope = String(body.section_scope ?? "all");

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "Enter a valid email address." }, 400);
  if (!fullName) return json({ error: "Enter a full name." }, 400);
  if (!ROLES.has(role)) return json({ error: "Unknown role." }, 400);
  if (!SCOPES.has(scope)) return json({ error: "Unknown section." }, 400);

  // 3. Create the login. Only now is the privileged key used, and only for the
  //    school the verified administrator belongs to.
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const password = temporaryPassword();
  const { error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role,
      school_id: caller.school_id,
    },
  });

  if (createError) {
    const message = createError.message.toLowerCase().includes("already")
      ? "That email address already has an account."
      : createError.message;
    return json({ error: message }, 400);
  }

  // The handle_new_user trigger builds the profile; fill in what only this
  // form knows.
  const { error: updateError } = await admin
    .from("profiles")
    .update({
      school_id: caller.school_id,
      role,
      section_scope: role === "staff" ? scope : "all",
      full_name: fullName,
      phone: body.phone ? String(body.phone) : null,
      vehicle_description: body.vehicle_description ? String(body.vehicle_description) : null,
    })
    .eq("email", email);

  if (updateError) return json({ error: updateError.message }, 400);

  return json({ email, password });
});
