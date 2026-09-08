"use client";

import * as React from "react";
import { useActionState, useEffect } from "react";
import { Copy, KeyRound, Pencil, Search, ShieldCheck, UserPlus, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Switch } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Avatar, EmptyState, ErrorMessage } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/provider";
import { createAccountAction, updatePersonAction } from "@/lib/api/mutations";
import { cn } from "@/lib/utils";
import type { ProfileRow, SectionScope, UserRole } from "@/lib/types/database";

const ROLES: UserRole[] = ["admin", "staff", "parent"];

const ROLE_TONE: Record<UserRole, string> = {
  admin: "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300",
  staff: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  parent: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
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
  const { t } = useI18n();
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
      return [person.full_name, person.email, person.phone].filter(Boolean).join(" ").toLowerCase().includes(needle);
    });
  }, [people, term, roleFilter]);

  return (
    <>
      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--color-muted)]" />
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder={t("people.searchPlaceholder")}
            aria-label={t("common.search")}
            className="ps-10"
          />
        </div>

        <Select
          value={roleFilter}
          onChange={(event) => setRoleFilter(event.target.value as UserRole | "")}
          aria-label={t("people.role")}
          className="w-auto min-w-44"
        >
          <option value="">{t("people.allRoles")}</option>
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {t(`role.${role}`)}
            </option>
          ))}
        </Select>

        <Button className="ms-auto" onClick={() => setCreating(true)}>
          <UserPlus className="size-4" />
          {t("people.addPerson")}
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          className="mt-6"
          icon={UsersRound}
          title={t(people.length === 0 ? "people.empty" : "people.noMatch")}
          action={
            people.length === 0 ? (
              <Button onClick={() => setCreating(true)}>
                <UserPlus className="size-4" />
                {t("people.addPerson")}
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
                    <p className="truncate text-[15.5px] font-bold tracking-[-0.01em]">{person.full_name || "—"}</p>
                    <span className={cn("rounded-md px-1.5 py-0.5 text-[11.5px] font-bold uppercase tracking-wide", ROLE_TONE[person.role])}>
                      {t(`role.${person.role}`)}
                    </span>
                    {!person.is_active ? (
                      <span className="rounded-md bg-rose-50 px-1.5 py-0.5 text-[11.5px] font-bold uppercase text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                        {t("people.deactivated")}
                      </span>
                    ) : null}
                  </div>
                  <p className="truncate text-[13px] text-[var(--color-muted)]" dir="ltr">
                    {person.email}
                    {person.phone ? ` · ${person.phone}` : ""}
                  </p>
                  {person.role === "staff" && person.section_scope !== "all" ? (
                    <p className="mt-0.5 text-[12.5px] text-[var(--color-muted)]">
                      {t(`scope.${person.section_scope}`)}
                    </p>
                  ) : null}
                  {person.role === "parent" ? (
                    <p className="mt-1 truncate text-[12.5px] text-[var(--color-muted)]">
                      {children.length > 0 ? t("people.canCollect", { names: children.join(", ") }) : t("people.noneLinked")}
                    </p>
                  ) : null}
                </div>
                <Button size="sm" variant="secondary" onClick={() => setEditing(person)}>
                  <Pencil className="size-3.5" />
                  {t("common.edit")}
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
  const { t } = useI18n();
  const [state, submit, submitting] = useActionState(createAccountAction, null);
  const [role, setRole] = React.useState<UserRole>("staff");
  const [scope, setScope] = React.useState<SectionScope>("boys");

  const created = state?.ok ? state.data : null;

  return (
    <Modal open={open} onClose={onClose} title={t(created ? "people.created" : "people.createTitle")} description={created ? undefined : t("people.createBody")}>
      {created?.password ? (
        <div className="space-y-4 pb-2">
          <div className="rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-600/15 dark:bg-emerald-500/10 dark:ring-emerald-400/20">
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-900 dark:text-emerald-100">
              <ShieldCheck className="size-4" />
              {t("people.created")}
            </p>
          </div>
          <dl className="space-y-2">
            <CopyRow label={t("people.email")} value={created.email} />
            <CopyRow label={t("login.password")} value={created.password} mono />
          </dl>
          <Button className="w-full" onClick={onClose}>
            {t("common.done")}
          </Button>
        </div>
      ) : (
        <form action={submit} className="space-y-4 pb-2">
          <Field label={t("people.fullName")} htmlFor="full_name">
            <Input id="full_name" name="full_name" required maxLength={120} data-autofocus />
          </Field>
          <Field label={t("people.email")} htmlFor="email" hint={t("people.emailHint")}>
            <Input id="email" name="email" type="email" required dir="ltr" />
          </Field>
          <Field label={t("people.role")} htmlFor="role">
            <Select id="role" name="role" value={role} onChange={(event) => setRole(event.target.value as UserRole)}>
              {ROLES.map((value) => (
                <option key={value} value={value}>
                  {t(`role.${value}`)}
                </option>
              ))}
            </Select>
          </Field>
          <p className="rounded-xl bg-black/[0.03] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-[var(--color-muted)] dark:bg-white/[0.05]">
            {t(`people.roleHint.${role}`)}
          </p>

          {role === "staff" ? (
            <Field label={t("people.scope")} htmlFor="section_scope" hint={t("people.scopeHint")}>
              <Select
                id="section_scope"
                name="section_scope"
                value={scope}
                onChange={(event) => setScope(event.target.value as SectionScope)}
              >
                {(["boys", "girls", "mixed", "all"] as SectionScope[]).map((value) => (
                  <option key={value} value={value}>
                    {t(`scope.${value}`)}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <input type="hidden" name="section_scope" value={role === "admin" ? "all" : "all"} />
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("people.phone")} htmlFor="phone">
              <Input id="phone" name="phone" type="tel" maxLength={40} dir="ltr" />
            </Field>
            {role === "parent" ? (
              <Field label={t("people.vehicle")} htmlFor="vehicle_description">
                <Input id="vehicle_description" name="vehicle_description" maxLength={120} />
              </Field>
            ) : null}
          </div>

          {state && !state.ok ? <ErrorMessage>{state.error}</ErrorMessage> : null}

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={submitting}>
              <UserPlus className="size-4" />
              {t("people.create")}
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
        <dt className="text-[11.5px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">{label}</dt>
        <dd className={cn("truncate text-sm font-semibold", mono && "font-mono")} dir="ltr">
          {value}
        </dd>
      </div>
      <button
        type="button"
        aria-label={label}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            toast.success("✓");
          } catch {
            toast.error("—");
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
  const { t } = useI18n();
  const toast = useToast();
  const [state, submit, submitting] = useActionState(updatePersonAction, null);
  const [active, setActive] = React.useState(person?.is_active ?? true);

  useEffect(() => {
    if (state?.ok) {
      toast.success(t("people.updated"));
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (!person) return null;

  return (
    <Modal open={open} onClose={onClose} title={t("people.editTitle")} description={person.email ?? undefined} size="sm">
      <form action={submit} className="space-y-4 pb-2">
        <input type="hidden" name="id" value={person.id} />
        <input type="hidden" name="is_active" value={active ? "true" : "false"} />

        <Field label={t("people.fullName")} htmlFor="edit_full_name">
          <Input id="edit_full_name" name="full_name" defaultValue={person.full_name} required maxLength={120} data-autofocus />
        </Field>

        <Field label={t("people.role")} htmlFor="edit_role" hint={isSelf ? t("people.selfRole") : undefined}>
          <Select id="edit_role" name="role" defaultValue={person.role} disabled={isSelf}>
            {ROLES.map((value) => (
              <option key={value} value={value}>
                {t(`role.${value}`)}
              </option>
            ))}
          </Select>
          {isSelf ? <input type="hidden" name="role" value={person.role} /> : null}
        </Field>

        {person.role === "staff" ? (
          <Field label={t("people.scope")} htmlFor="edit_scope" hint={t("people.scopeHint")}>
            <Select id="edit_scope" name="section_scope" defaultValue={person.section_scope ?? "all"}>
              {(["boys", "girls", "mixed", "all"] as SectionScope[]).map((value) => (
                <option key={value} value={value}>
                  {t(`scope.${value}`)}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <input type="hidden" name="section_scope" value={person.section_scope ?? "all"} />
        )}

        <Field label={t("people.phone")} htmlFor="edit_phone">
          <Input id="edit_phone" name="phone" type="tel" defaultValue={person.phone ?? ""} maxLength={40} dir="ltr" />
        </Field>

        {person.role === "parent" ? (
          <Field label={t("people.vehicle")} htmlFor="edit_vehicle">
            <Input id="edit_vehicle" name="vehicle_description" defaultValue={person.vehicle_description ?? ""} maxLength={120} />
          </Field>
        ) : null}

        <Switch checked={active} onChange={setActive} disabled={isSelf} label={t("people.active")} description={t("people.activeHint")} />

        <p className="flex items-start gap-2 rounded-xl bg-black/[0.03] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-[var(--color-muted)] dark:bg-white/[0.05]">
          <KeyRound className="mt-0.5 size-3.5 shrink-0" />
          {t("people.passwordNote")}
        </p>

        {state && !state.ok ? <ErrorMessage>{state.error}</ErrorMessage> : null}

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" loading={submitting}>
            {t("common.saveChanges")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
