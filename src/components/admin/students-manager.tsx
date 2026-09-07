"use client";

import * as React from "react";
import { useActionState, useEffect } from "react";
import { GraduationCap, Hash, Pencil, Plus, Search, Trash2, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Switch } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Avatar, EmptyState, ErrorMessage } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { deleteStudentAction, saveStudentAction } from "@/server/actions/roster";
import { linkGuardianAction, setGuardianPickupAction, unlinkGuardianAction } from "@/server/actions/people";
import { cn } from "@/lib/utils";
import type { ClassroomRow, ProfileRow } from "@/lib/types/database";
import type { StudentGuardianLink, StudentWithClassroom } from "@/server/queries/dismissal";

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
      return [student.first_name, student.last_name, student.grade, student.classroom?.name, student.pickup_number]
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
      toast.error("Couldn't remove the student", result.error);
      return;
    }
    toast.success(`${deleting.first_name} removed`);
    setDeleting(null);
  }

  return (
    <>
      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--color-muted)]" />
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search students…"
            aria-label="Search students"
            className="pl-10"
          />
        </div>

        <Select
          value={classroomFilter}
          onChange={(event) => setClassroomFilter(event.target.value)}
          aria-label="Filter by class"
          className="w-auto min-w-40"
        >
          <option value="">All classes</option>
          {classrooms.map((classroom) => (
            <option key={classroom.id} value={classroom.id}>
              {classroom.name} · {classroom.grade}
            </option>
          ))}
        </Select>

        <span className="tabular text-[13px] text-[var(--color-muted)]">
          {filtered.length} of {students.length}
        </span>

        {canEdit ? (
          <Button className="ml-auto hidden lg:inline-flex" onClick={() => setEditing("new")}>
            <Plus className="size-4" />
            Add student
          </Button>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          className="mt-6"
          icon={GraduationCap}
          title={students.length === 0 ? "No students yet" : "No students match that search"}
          description={
            students.length === 0
              ? "Add your roster so parents can request pickups and staff can call students."
              : "Try a different name, grade or pickup number."
          }
          action={
            canEdit && students.length === 0 ? (
              <Button onClick={() => setEditing("new")}>
                <Plus className="size-4" />
                Add a student
              </Button>
            ) : null
          }
        />
      ) : (
        <ul className="mt-4 space-y-2.5">
          {filtered.map((student) => {
            const name = `${student.first_name} ${student.last_name}`.trim();
            const links = linksByStudent.get(student.id) ?? [];

            return (
              <li key={student.id} className="surface-card flex flex-wrap items-center gap-3.5 p-4">
                <Avatar name={name} size="md" />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="truncate text-[15.5px] font-bold tracking-[-0.01em]">{name}</p>
                    {student.pickup_number ? (
                      <span className="tabular inline-flex items-center gap-0.5 rounded-md bg-black/[0.06] px-1.5 py-0.5 text-[12px] font-bold dark:bg-white/[0.1]">
                        <Hash className="size-3 opacity-60" />
                        {student.pickup_number}
                      </span>
                    ) : null}
                    {!student.is_active ? (
                      <span className="rounded-md bg-rose-50 px-1.5 py-0.5 text-[11.5px] font-bold uppercase text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                        Inactive
                      </span>
                    ) : null}
                  </div>

                  <p className="truncate text-[13px] text-[var(--color-muted)]">
                    {[student.grade, student.classroom?.name ? `Class ${student.classroom.name}` : null]
                      .filter(Boolean)
                      .join(" — ") || "No class assigned"}
                  </p>

                  <p className="mt-1 truncate text-[12.5px] text-[var(--color-muted)]">
                    {links.length === 0
                      ? "No pickup permissions set"
                      : `Pickup: ${links
                          .filter((link) => link.can_pickup)
                          .map((link) => link.profile?.full_name ?? "Unknown")
                          .join(", ") || "nobody authorised"}`}
                  </p>
                </div>

                {canEdit ? (
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="secondary" onClick={() => setEditing(student)}>
                      <Pencil className="size-3.5" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Remove ${name}`}
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
            title={deleting ? `Remove ${deleting.first_name} ${deleting.last_name}?` : "Remove student"}
            description="This deletes the student and their dismissal history. This cannot be undone."
            size="sm"
            footer={
              <>
                <Button variant="secondary" onClick={() => setDeleting(null)}>
                  Keep student
                </Button>
                <Button variant="danger" onClick={confirmDelete} loading={busy}>
                  Remove student
                </Button>
              </>
            }
          >
            <p className="pb-2 text-sm text-[var(--color-muted)]">
              If the student has simply left for the year, set them inactive instead — that keeps
              your records.
            </p>
          </Modal>
        </>
      ) : null}

      {canEdit ? (
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="fixed bottom-6 right-6 z-20 inline-flex h-14 items-center gap-2 rounded-2xl bg-brand-600 px-5 text-[15px] font-semibold text-white shadow-pop transition hover:bg-brand-700 active:scale-[0.98] lg:hidden"
        >
          <Plus className="size-5" />
          Add
        </button>
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
  const toast = useToast();
  const [state, save, saving] = useActionState(saveStudentAction, null);
  const [active, setActive] = React.useState(student?.is_active ?? true);
  const [guardianId, setGuardianId] = React.useState("");
  const [relationship, setRelationship] = React.useState("Parent");
  const [linking, setLinking] = React.useState(false);

  useEffect(() => {
    if (state?.ok) {
      toast.success(student ? "Student updated" : "Student added");
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  async function addGuardian() {
    if (!student || !guardianId) return;
    setLinking(true);
    const result = await linkGuardianAction({
      studentId: student.id,
      profileId: guardianId,
      relationship,
    });
    setLinking(false);

    if (!result.ok) {
      toast.error("Couldn't add the guardian", result.error);
      return;
    }
    toast.success("Pickup permission added");
    setGuardianId("");
  }

  const linkedIds = new Set(links.map((link) => link.profile_id));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={student ? "Edit student" : "Add a student"}
      description={
        student
          ? "Changes apply to future dismissals. Past records keep the details they were created with."
          : "Add a student to the roster so parents can request their pickup."
      }
    >
      <form action={save} className="space-y-4 pb-2">
        {student ? <input type="hidden" name="id" value={student.id} /> : null}
        <input type="hidden" name="is_active" value={active ? "true" : "false"} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" htmlFor="first_name">
            <Input
              id="first_name"
              name="first_name"
              defaultValue={student?.first_name ?? ""}
              required
              maxLength={80}
              data-autofocus
            />
          </Field>
          <Field label="Last name" htmlFor="last_name">
            <Input
              id="last_name"
              name="last_name"
              defaultValue={student?.last_name ?? ""}
              maxLength={80}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Grade" htmlFor="grade" hint="Shown on the board, e.g. Grade 7.">
            <Input id="grade" name="grade" defaultValue={student?.grade ?? ""} maxLength={40} />
          </Field>
          <Field label="Class" htmlFor="classroom_id">
            <Select id="classroom_id" name="classroom_id" defaultValue={student?.classroom_id ?? ""}>
              <option value="">No class</option>
              {classrooms.map((classroom) => (
                <option key={classroom.id} value={classroom.id}>
                  {classroom.name} · {classroom.grade}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field
          label="Pickup number"
          htmlFor="pickup_number"
          hint="Optional. Families can share one number for siblings."
        >
          <Input
            id="pickup_number"
            name="pickup_number"
            defaultValue={student?.pickup_number ?? ""}
            maxLength={20}
            placeholder="104"
          />
        </Field>

        <Field label="Notes" htmlFor="notes" hint="Only staff can see this.">
          <Input id="notes" name="notes" defaultValue={student?.notes ?? ""} maxLength={500} />
        </Field>

        <Switch
          checked={active}
          onChange={setActive}
          label="Currently enrolled"
          description="Inactive students stay in your records but can't be added to the queue."
        />

        {state && !state.ok ? <ErrorMessage>{state.error}</ErrorMessage> : null}

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {student ? "Save changes" : "Add student"}
          </Button>
        </div>
      </form>

      {student ? (
        <section className="mt-6 border-t border-[var(--color-hairline)] pt-5">
          <h3 className="text-[14px] font-semibold">Who may pick up {student.first_name}?</h3>
          <p className="mt-1 text-[13px] text-[var(--color-muted)]">
            Only these accounts can see this student or request their dismissal.
          </p>

          <ul className="mt-3 space-y-2">
            {links.length === 0 ? (
              <li className="rounded-xl border border-dashed border-[var(--color-hairline)] px-4 py-5 text-center text-[13px] text-[var(--color-muted)]">
                Nobody is linked yet.
              </li>
            ) : (
              links.map((link) => (
                <li
                  key={link.id}
                  className="flex items-center gap-3 rounded-xl bg-black/[0.03] px-3 py-2.5 dark:bg-white/[0.04]"
                >
                  <Avatar name={link.profile?.full_name ?? "?"} size="xs" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold">
                      {link.profile?.full_name ?? "Unknown"}
                    </p>
                    <p className="truncate text-[12px] text-[var(--color-muted)]">
                      {link.relationship}
                      {link.profile?.email ? ` · ${link.profile.email}` : ""}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      const result = await setGuardianPickupAction({
                        guardianId: link.id,
                        canPickup: !link.can_pickup,
                      });
                      if (!result.ok) toast.error("Couldn't update", result.error);
                    }}
                    className={cn(
                      "shrink-0 rounded-md px-2 py-1 text-[11.5px] font-bold uppercase tracking-wide transition",
                      link.can_pickup
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
                        : "bg-black/[0.06] text-[var(--color-muted)] dark:bg-white/[0.08]",
                    )}
                  >
                    {link.can_pickup ? "Can pick up" : "Blocked"}
                  </button>

                  <button
                    type="button"
                    aria-label="Remove permission"
                    onClick={async () => {
                      const result = await unlinkGuardianAction(link.id);
                      if (!result.ok) toast.error("Couldn't remove", result.error);
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
            <Field label="Add a guardian" className="min-w-44 flex-1">
              <Select value={guardianId} onChange={(event) => setGuardianId(event.target.value)}>
                <option value="">Choose a parent account…</option>
                {parents
                  .filter((parent) => !linkedIds.has(parent.id))
                  .map((parent) => (
                    <option key={parent.id} value={parent.id}>
                      {parent.full_name} · {parent.email}
                    </option>
                  ))}
              </Select>
            </Field>

            <Field label="Relationship" className="w-36">
              <Input
                value={relationship}
                onChange={(event) => setRelationship(event.target.value)}
                maxLength={60}
              />
            </Field>

            <Button
              type="button"
              variant="secondary"
              onClick={addGuardian}
              disabled={!guardianId}
              loading={linking}
            >
              <UserPlus className="size-4" />
              Link
            </Button>
          </div>
        </section>
      ) : null}
    </Modal>
  );
}
