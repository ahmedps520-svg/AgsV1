"use client";

import * as React from "react";
import { useActionState, useEffect } from "react";
import { GraduationCap, Pencil, Plus, Search, Trash2, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Switch } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Avatar, EmptyState, ErrorMessage } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/provider";
import {
  deleteStudentAction,
  linkGuardianAction,
  saveStudentAction,
  setGuardianPickupAction,
  unlinkGuardianAction,
} from "@/lib/api/mutations";
import { classLabel, levelLabel } from "@/lib/classes";
import { cn } from "@/lib/utils";
import type { ClassroomRow, ProfileRow } from "@/lib/types/database";
import type { StudentGuardianLink, StudentWithClassroom } from "@/lib/api/queries";

export function StudentsManager({
  students,
  classrooms,
  parents,
  guardianLinks,
  canEdit,
}: {
  students: StudentWithClassroom[];
  classrooms: ClassroomRow[];
  parents: ProfileRow[];
  guardianLinks: StudentGuardianLink[];
  canEdit: boolean;
}) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [term, setTerm] = React.useState("");
  const [classroomFilter, setClassroomFilter] = React.useState("");
  const [editing, setEditing] = React.useState<StudentWithClassroom | "new" | null>(null);
  const [deleting, setDeleting] = React.useState<StudentWithClassroom | null>(null);
  const [busy, setBusy] = React.useState(false);

  const linksByStudent = React.useMemo(() => {
    const map = new Map<string, StudentGuardianLink[]>();
    for (const link of guardianLinks) {
      const list = map.get(link.student_id) ?? [];
      list.push(link);
      map.set(link.student_id, list);
    }
    return map;
  }, [guardianLinks]);

  const filtered = React.useMemo(() => {
    const needle = term.trim().toLowerCase();
    return students.filter((student) => {
      if (classroomFilter && student.classroom_id !== classroomFilter) return false;
      if (!needle) return true;
      return [student.first_name, student.last_name, student.grade, student.classroom?.name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [students, term, classroomFilter]);

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    const result = await deleteStudentAction(deleting.id);
    setBusy(false);
    if (!result.ok) {
      toast.error(t("board.toast.failed"), result.error);
      return;
    }
    toast.success(t("students.removed", { name: deleting.first_name }));
    setDeleting(null);
  }

  return (
    <>
      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--color-muted)]" />
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder={t("students.searchPlaceholder")}
            aria-label={t("common.search")}
            className="ps-10"
          />
        </div>

        <Select
          value={classroomFilter}
          onChange={(event) => setClassroomFilter(event.target.value)}
          aria-label={t("students.class")}
          className="w-auto min-w-40"
        >
          <option value="">{t("students.allClasses")}</option>
          {classrooms.map((room) => (
            <option key={room.id} value={room.id}>
              {room.name} — {classLabel(room, locale)}
            </option>
          ))}
        </Select>

        <span className="tabular text-[13px] text-[var(--color-muted)]">
          {filtered.length} {t("common.of")} {students.length}
        </span>

        {canEdit ? (
          <Button className="ms-auto hidden lg:inline-flex" onClick={() => setEditing("new")}>
            <Plus className="size-4" />
            {t("students.addStudent")}
          </Button>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          className="mt-6"
          icon={GraduationCap}
          title={t(students.length === 0 ? "students.empty" : "students.noMatch")}
          description={t(students.length === 0 ? "students.emptyHint" : "students.noMatchHint")}
          action={
            canEdit && students.length === 0 ? (
              <Button onClick={() => setEditing("new")}>
                <Plus className="size-4" />
                {t("students.addStudent")}
              </Button>
            ) : null
          }
        />
      ) : (
        <ul className="mt-4 space-y-2.5">
          {filtered.map((student) => {
            const name = `${student.first_name} ${student.last_name}`.trim();
            const links = linksByStudent.get(student.id) ?? [];
            const pickup = links.filter((link) => link.can_pickup).map((link) => link.profile?.full_name ?? "?");

            return (
              <li key={student.id} className="surface-card flex flex-wrap items-center gap-3.5 p-4">
                <Avatar name={name} size="md" />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="truncate text-[15.5px] font-bold tracking-[-0.01em]">{name}</p>
                    {student.classroom ? (
                      <span className="code rounded-md bg-brand-50 px-1.5 py-0.5 text-[12px] font-bold text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">
                        {student.classroom.name}
                      </span>
                    ) : null}
                    {!student.is_active ? (
                      <span className="rounded-md bg-rose-50 px-1.5 py-0.5 text-[11.5px] font-bold uppercase text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                        {t("students.inactive")}
                      </span>
                    ) : null}
                  </div>

                  <p className="truncate text-[13px] text-[var(--color-muted)]">
                    {student.classroom ? classLabel(student.classroom, locale) : t("students.noClass")}
                  </p>

                  <p className="mt-1 truncate text-[12.5px] text-[var(--color-muted)]">
                    {links.length === 0
                      ? t("students.noPickup")
                      : t("students.pickup", { names: pickup.join(", ") || t("students.nobody") })}
                  </p>
                </div>

                {canEdit ? (
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="secondary" onClick={() => setEditing(student)}>
                      <Pencil className="size-3.5" />
                      {t("common.edit")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={t("students.removeTitle", { name })}
                      className="text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
                      onClick={() => setDeleting(student)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {canEdit ? (
        <>
          <StudentModal
            key={editing === "new" ? "new" : (editing?.id ?? "closed")}
            open={editing !== null}
            student={editing === "new" ? null : editing}
            classrooms={classrooms}
            parents={parents}
            links={editing && editing !== "new" ? (linksByStudent.get(editing.id) ?? []) : []}
            onClose={() => setEditing(null)}
          />

          <Modal
            open={deleting !== null}
            onClose={() => setDeleting(null)}
            title={deleting ? t("students.removeTitle", { name: `${deleting.first_name} ${deleting.last_name}` }) : ""}
            description={t("students.removeBody")}
            size="sm"
            footer={
              <>
                <Button variant="secondary" onClick={() => setDeleting(null)}>
                  {t("students.keep")}
                </Button>
                <Button variant="danger" onClick={confirmDelete} loading={busy}>
                  {t("common.remove")}
                </Button>
              </>
            }
          >
            <p className="pb-2 text-sm text-[var(--color-muted)]">{t("students.removeHint")}</p>
          </Modal>

          <button
            type="button"
            onClick={() => setEditing("new")}
            className="fixed bottom-6 end-6 z-20 inline-flex h-14 items-center gap-2 rounded-2xl bg-brand-600 px-5 text-[15px] font-semibold text-white shadow-pop transition hover:bg-brand-700 active:scale-[0.98] lg:hidden"
          >
            <Plus className="size-5" />
            {t("common.add")}
          </button>
        </>
      ) : null}
    </>
  );
}

/* -------------------------------------------------------------------------- */

function StudentModal({
  open,
  student,
  classrooms,
  parents,
  links,
  onClose,
}: {
  open: boolean;
  student: StudentWithClassroom | null;
  classrooms: ClassroomRow[];
  parents: ProfileRow[];
  links: StudentGuardianLink[];
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [state, save, saving] = useActionState(saveStudentAction, null);
  const [active, setActive] = React.useState(student?.is_active ?? true);
  const [guardianId, setGuardianId] = React.useState("");
  const [relationship, setRelationship] = React.useState("Parent");
  const [linking, setLinking] = React.useState(false);

  useEffect(() => {
    if (state?.ok) {
      toast.success(t(student ? "students.updated" : "students.added"));
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  async function addGuardian() {
    if (!student || !guardianId) return;
    setLinking(true);
    const result = await linkGuardianAction({ studentId: student.id, profileId: guardianId, relationship });
    setLinking(false);
    if (!result.ok) {
      toast.error(t("board.toast.failed"), result.error);
      return;
    }
    setGuardianId("");
  }

  const linkedIds = new Set(links.map((link) => link.profile_id));

  // Group the class dropdown by grade so a 50-class list stays navigable.
  const groups = React.useMemo(() => {
    const map = new Map<string, ClassroomRow[]>();
    for (const room of classrooms) {
      const list = map.get(room.level) ?? [];
      list.push(room);
      map.set(room.level, list);
    }
    return [...map.entries()];
  }, [classrooms]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t(student ? "students.editTitle" : "students.addTitle")}
    >
      <form action={save} className="space-y-4 pb-2">
        {student ? <input type="hidden" name="id" value={student.id} /> : null}
        <input type="hidden" name="is_active" value={active ? "true" : "false"} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("students.firstName")} htmlFor="first_name">
            <Input id="first_name" name="first_name" defaultValue={student?.first_name ?? ""} required maxLength={80} data-autofocus />
          </Field>
          <Field label={t("students.lastName")} htmlFor="last_name">
            <Input id="last_name" name="last_name" defaultValue={student?.last_name ?? ""} maxLength={80} />
          </Field>
        </div>

        <Field label={t("students.class")} htmlFor="classroom_id">
          <Select id="classroom_id" name="classroom_id" defaultValue={student?.classroom_id ?? ""}>
            <option value="">{t("students.noClass")}</option>
            {groups.map(([level, rooms]) => (
              <optgroup key={level} label={levelLabel(level, locale)}>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name} — {classLabel(room, locale)}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </Field>

        <Field label={t("students.notes")} htmlFor="notes" hint={t("students.notesHint")}>
          <Input id="notes" name="notes" defaultValue={student?.notes ?? ""} maxLength={500} />
        </Field>

        <Switch
          checked={active}
          onChange={setActive}
          label={t("students.enrolled")}
          description={t("students.enrolledHint")}
        />

        {state && !state.ok ? <ErrorMessage>{state.error}</ErrorMessage> : null}

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" loading={saving}>
            {t(student ? "common.saveChanges" : "students.addStudent")}
          </Button>
        </div>
      </form>

      {student ? (
        <section className="mt-6 border-t border-[var(--color-hairline)] pt-5">
          <h3 className="text-[14px] font-semibold">{t("students.guardiansTitle", { name: student.first_name })}</h3>
          <p className="mt-1 text-[13px] text-[var(--color-muted)]">{t("students.guardiansBody")}</p>

          <ul className="mt-3 space-y-2">
            {links.length === 0 ? (
              <li className="rounded-xl border border-dashed border-[var(--color-hairline)] px-4 py-5 text-center text-[13px] text-[var(--color-muted)]">
                {t("students.noGuardians")}
              </li>
            ) : (
              links.map((link) => (
                <li key={link.id} className="flex items-center gap-3 rounded-xl bg-black/[0.03] px-3 py-2.5 dark:bg-white/[0.04]">
                  <Avatar name={link.profile?.full_name ?? "?"} size="xs" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold">{link.profile?.full_name ?? "—"}</p>
                    <p className="truncate text-[12px] text-[var(--color-muted)]" dir="ltr">
                      {link.relationship}
                      {link.profile?.email ? ` · ${link.profile.email}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const result = await setGuardianPickupAction({ guardianId: link.id, canPickup: !link.can_pickup });
                      if (!result.ok) toast.error(t("board.toast.failed"), result.error);
                    }}
                    className={cn(
                      "shrink-0 rounded-md px-2 py-1 text-[11.5px] font-bold uppercase tracking-wide transition",
                      link.can_pickup
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
                        : "bg-black/[0.06] text-[var(--color-muted)] dark:bg-white/[0.08]",
                    )}
                  >
                    {t(link.can_pickup ? "students.canPickUp" : "students.blocked")}
                  </button>
                  <button
                    type="button"
                    aria-label={t("common.remove")}
                    onClick={async () => {
                      const result = await unlinkGuardianAction(link.id);
                      if (!result.ok) toast.error(t("board.toast.failed"), result.error);
                    }}
                    className="shrink-0 rounded-md p-1.5 text-[var(--color-muted)] transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))
            )}
          </ul>

          <div className="mt-3 flex flex-wrap items-end gap-2">
            <Field label={t("students.addGuardian")} className="min-w-44 flex-1">
              <Select value={guardianId} onChange={(event) => setGuardianId(event.target.value)}>
                <option value="">{t("students.chooseParent")}</option>
                {parents
                  .filter((parent) => !linkedIds.has(parent.id))
                  .map((parent) => (
                    <option key={parent.id} value={parent.id}>
                      {parent.full_name} · {parent.email}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label={t("students.relationship")} className="w-36">
              <Input value={relationship} onChange={(event) => setRelationship(event.target.value)} maxLength={60} />
            </Field>
            <Button type="button" variant="secondary" onClick={addGuardian} disabled={!guardianId} loading={linking}>
              <UserPlus className="size-4" />
              {t("students.link")}
            </Button>
          </div>
        </section>
      ) : null}
    </Modal>
  );
}
