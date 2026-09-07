"use client";

import * as React from "react";
import { useActionState, useEffect } from "react";
import {
  Copy,
  KeyRound,
  MailCheck,
  Pencil,
  Search,
  ShieldCheck,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Switch } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Avatar, EmptyState, ErrorMessage } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { createAccountAction, updatePersonAction } from "@/lib/api/mutations";
import { IS_DEMO } from "@/lib/api/config";
import { cn } from "@/lib/utils";
import type { ProfileRow, UserRole } from "@/lib/types/database";

const ROLE_LABEL: Record<UserRole, string> = {
  admin: "Administrator",
  staff: "Teacher / staff",
  parent: "Parent / driver",
  display: "Display board",
};

const ROLE_TONE: Record<UserRole, string> = {
  admin: "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300",
  staff: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  parent: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  display: "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300",
};

export function PeopleManager({
  people,
  guardianLinks,
  currentUserId,
}: {
  people: ProfileRow[];
  guardianLinks: { profile_id: string; student: { first_name: string; last_name: string } | null }[];
  currentUserId: string;
}) {
  const [term, setTerm] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState<UserRole | "">("");
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState<ProfileRow | null>(null);

  const studentsByGuardian = React.useMemo(() => {
    const map = new Map<string, string[]>();
    for (const link of guardianLinks) {
      if (!link.student) continue;
      const list = map.get(link.profile_id) ?? [];
      list.push(`${link.student.first_name} ${link.student.last_name}`.trim());
      map.set(link.profile_id, list);
    }
    return map;
  }, [guardianLinks]);

  const filtered = React.useMemo(() => {
    const needle = term.trim().toLowerCase();
    return people.filter((person) => {
      if (roleFilter && person.role !== roleFilter) return false;
      if (!needle) return true;
      return [person.full_name, person.email, person.phone]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [people, term, roleFilter]);

  return (
    <>
      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--color-muted)]" />
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search people…"
            aria-label="Search people"
            className="pl-10"
          />
        </div>

        <Select
          value={roleFilter}
          onChange={(event) => setRoleFilter(event.target.value as UserRole | "")}
          aria-label="Filter by role"
          className="w-auto min-w-44"
        >
          <option value="">All roles</option>
          {(Object.keys(ROLE_LABEL) as UserRole[]).map((role) => (
            <option key={role} value={role}>
              {ROLE_LABEL[role]}
            </option>
          ))}
        </Select>

        <Button className="ml-auto" onClick={() => setCreating(true)}>
          <UserPlus className="size-4" />
          Add person
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          className="mt-6"
          icon={UsersRound}
          title={people.length === 0 ? "No accounts yet" : "Nobody matches that search"}
          description="Create accounts for teachers, parents, drivers and the hallway display."
          action={
            people.length === 0 ? (
              <Button onClick={() => setCreating(true)}>
                <UserPlus className="size-4" />
                Add the first person
              </Button>
            ) : null
          }
        />
      ) : (
        <ul className="mt-4 space-y-2.5">
          {filtered.map((person) => {
            const children = studentsByGuardian.get(person.id) ?? [];
            return (
              <li key={person.id} className="surface-card flex flex-wrap items-center gap-3.5 p-4">
                <Avatar name={person.full_name || person.email || "?"} size="md" />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="truncate text-[15.5px] font-bold tracking-[-0.01em]">
                      {person.full_name || "Unnamed"}
                    </p>
                    <span
                      className={cn(
                        "rounded-md px-1.5 py-0.5 text-[11.5px] font-bold uppercase tracking-wide",
                        ROLE_TONE[person.role],
                      )}
                    >
                      {ROLE_LABEL[person.role]}
                    </span>
                    {!person.is_active ? (
                      <span className="rounded-md bg-rose-50 px-1.5 py-0.5 text-[11.5px] font-bold uppercase text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                        Deactivated
                      </span>
                    ) : null}
                  </div>

                  <p className="truncate text-[13px] text-[var(--color-muted)]">
                    {person.email}
                    {person.phone ? ` · ${person.phone}` : ""}
                  </p>

                  {person.role === "parent" ? (
                    <p className="mt-1 truncate text-[12.5px] text-[var(--color-muted)]">
                      {children.length > 0
                        ? `Can collect: ${children.join(", ")}`
                        : "No students linked — link them from the Students page"}
                    </p>
                  ) : null}
                </div>

                <Button size="sm" variant="secondary" onClick={() => setEditing(person)}>
                  <Pencil className="size-3.5" />
                  Edit
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <CreatePersonModal open={creating} onClose={() => setCreating(false)} />
      <EditPersonModal
        key={editing?.id ?? "closed"}
        open={editing !== null}
        person={editing}
        isSelf={editing?.id === currentUserId}
        onClose={() => setEditing(null)}
      />
    </>
  );
}

/* -------------------------------------------------------------------------- */

function CreatePersonModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [state, submit, submitting] = useActionState(createAccountAction, null);
  const [sendInvite, setSendInvite] = React.useState(false);
  const [role, setRole] = React.useState<UserRole>("parent");

  useEffect(() => {
    if (state?.ok && state.data.invited) {
      toast.success("Invitation sent", `${state.data.email} will get an email to set a password.`);
    }
  }, [state, toast]);

  const created = state?.ok ? state.data : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={created ? "Account created" : "Add a person"}
      description={
        created
          ? undefined
          : "Create a login for a teacher, a parent, an authorised driver, or a hallway display."
      }
    >
      {created && !created.invited && created.password ? (
        <div className="space-y-4 pb-2">
          <div className="rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-600/15 dark:bg-emerald-500/10 dark:ring-emerald-400/20">
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-900 dark:text-emerald-100">
              <ShieldCheck className="size-4" />
              Share these details once
            </p>
            <p className="mt-1.5 text-[13px] text-emerald-800/85 dark:text-emerald-200/85">
              The password is shown only now. Ask them to change it from their account page after
              signing in.
            </p>
          </div>

          <dl className="space-y-2">
            <CopyRow label="Email" value={created.email} />
            <CopyRow label="Temporary password" value={created.password} mono />
          </dl>

          <Button className="w-full" onClick={onClose}>
            Done
          </Button>
        </div>
      ) : created?.invited ? (
        <div className="space-y-4 pb-2 text-center">
          <MailCheck className="mx-auto size-10 text-emerald-600 dark:text-emerald-400" />
          <p className="text-sm font-semibold">Invitation sent to {created.email}</p>
          <Button className="w-full" onClick={onClose}>
            Done
          </Button>
        </div>
      ) : (
        <form action={submit} className="space-y-4 pb-2">
          <input type="hidden" name="send_invite" value={sendInvite ? "on" : ""} />

          {!IS_DEMO ? (
            <div className="rounded-xl bg-brand-50 px-3.5 py-3 text-[12.5px] leading-relaxed text-brand-900 ring-1 ring-brand-600/15 dark:bg-brand-500/10 dark:text-brand-100 dark:ring-brand-400/20">
              <p className="font-semibold">Logins are created in the Supabase dashboard.</p>
              <p className="mt-1">
                This site runs entirely in the browser, so it cannot hold the server key that
                creates accounts. Go to <span className="font-mono">Authentication → Users → Add user</span>,
                set the user metadata to the role and school id, and the profile appears here
                automatically. DEPLOYMENT.md has the exact steps.
              </p>
            </div>
          ) : null}

          <Field label="Full name" htmlFor="full_name">
            <Input id="full_name" name="full_name" required maxLength={120} data-autofocus />
          </Field>

          <Field label="Email address" htmlFor="email" hint="This is their sign-in name.">
            <Input id="email" name="email" type="email" required />
          </Field>

          <Field label="Role" htmlFor="role">
            <Select
              id="role"
              name="role"
              value={role}
              onChange={(event) => setRole(event.target.value as UserRole)}
            >
              {(Object.keys(ROLE_LABEL) as UserRole[]).map((value) => (
                <option key={value} value={value}>
                  {ROLE_LABEL[value]}
                </option>
              ))}
            </Select>
          </Field>

          <p className="rounded-xl bg-black/[0.03] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-[var(--color-muted)] dark:bg-white/[0.05]">
            {role === "admin"
              ? "Full access: roster, accounts, settings and the dismissal queue."
              : role === "staff"
                ? "Can run the dismissal queue and view the roster. Cannot change accounts or settings."
                : role === "parent"
                  ? "Sees only the students you link to them, and can request their pickup."
                  : "Read-only account for a hallway or lobby screen. Cannot change the queue."}
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone" htmlFor="phone">
              <Input id="phone" name="phone" type="tel" maxLength={40} />
            </Field>
            {role === "parent" ? (
              <Field label="Vehicle" htmlFor="vehicle_description">
                <Input
                  id="vehicle_description"
                  name="vehicle_description"
                  placeholder="White SUV · ABC 1234"
                  maxLength={120}
                />
              </Field>
            ) : null}
          </div>

          <Switch
            checked={sendInvite}
            onChange={setSendInvite}
            label="Email them an invitation"
            description="Otherwise we generate a temporary password you can hand over in person."
          />

          {state && !state.ok ? <ErrorMessage>{state.error}</ErrorMessage> : null}

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              <UserPlus className="size-4" />
              Create account
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function CopyRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const toast = useToast();

  return (
    <div className="flex items-center gap-3 rounded-xl bg-black/[0.03] px-3.5 py-2.5 dark:bg-white/[0.05]">
      <div className="min-w-0 flex-1">
        <dt className="text-[11.5px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          {label}
        </dt>
        <dd className={cn("truncate text-sm font-semibold", mono && "font-mono")}>{value}</dd>
      </div>
      <button
        type="button"
        aria-label={`Copy ${label}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            toast.success("Copied");
          } catch {
            toast.error("Couldn't copy", "Select the text and copy it manually.");
          }
        }}
        className="shrink-0 rounded-lg p-2 text-[var(--color-muted)] transition hover:bg-black/5 hover:text-[var(--color-ink)] dark:hover:bg-white/10"
      >
        <Copy className="size-4" />
      </button>
    </div>
  );
}

function EditPersonModal({
  open,
  person,
  isSelf,
  onClose,
}: {
  open: boolean;
  person: ProfileRow | null;
  isSelf: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const [state, submit, submitting] = useActionState(updatePersonAction, null);
  const [active, setActive] = React.useState(person?.is_active ?? true);

  useEffect(() => {
    if (state?.ok) {
      toast.success("Account updated");
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (!person) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit account"
      description={person.email ?? undefined}
      size="sm"
    >
      <form action={submit} className="space-y-4 pb-2">
        <input type="hidden" name="id" value={person.id} />
        <input type="hidden" name="is_active" value={active ? "true" : "false"} />

        <Field label="Full name" htmlFor="edit_full_name">
          <Input
            id="edit_full_name"
            name="full_name"
            defaultValue={person.full_name}
            required
            maxLength={120}
            data-autofocus
          />
        </Field>

        <Field
          label="Role"
          htmlFor="edit_role"
          hint={isSelf ? "You can't remove your own administrator access." : undefined}
        >
          <Select id="edit_role" name="role" defaultValue={person.role} disabled={isSelf}>
            {(Object.keys(ROLE_LABEL) as UserRole[]).map((value) => (
              <option key={value} value={value}>
                {ROLE_LABEL[value]}
              </option>
            ))}
          </Select>
          {isSelf ? <input type="hidden" name="role" value={person.role} /> : null}
        </Field>

        <Field label="Phone" htmlFor="edit_phone">
          <Input id="edit_phone" name="phone" type="tel" defaultValue={person.phone ?? ""} maxLength={40} />
        </Field>

        {person.role === "parent" ? (
          <Field label="Vehicle" htmlFor="edit_vehicle">
            <Input
              id="edit_vehicle"
              name="vehicle_description"
              defaultValue={person.vehicle_description ?? ""}
              maxLength={120}
            />
          </Field>
        ) : null}

        <Switch
          checked={active}
          onChange={setActive}
          disabled={isSelf}
          label="Account is active"
          description="A deactivated account cannot sign in or appear in the queue."
        />

        <p className="flex items-start gap-2 rounded-xl bg-black/[0.03] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-[var(--color-muted)] dark:bg-white/[0.05]">
          <KeyRound className="mt-0.5 size-3.5 shrink-0" />
          Passwords are changed by the account holder from their own account page, or reset with the
          &ldquo;Forgot password&rdquo; link on the sign-in screen.
        </p>

        {state && !state.ok ? <ErrorMessage>{state.error}</ErrorMessage> : null}

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            Save changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}
