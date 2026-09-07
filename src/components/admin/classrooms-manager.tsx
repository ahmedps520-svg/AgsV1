"use client";

import * as React from "react";
import { useActionState, useEffect } from "react";
import { DoorOpen, Pencil, Plus, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { EmptyState, ErrorMessage } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { deleteClassroomAction, saveClassroomAction } from "@/server/actions/roster";
import type { ClassroomRow, ProfileRow } from "@/lib/types/database";

export function ClassroomsManager({
  classrooms,
  teachers,
  studentCounts,
  canEdit,
}: {
  classrooms: ClassroomRow[];
  teachers: ProfileRow[];
  studentCounts: Record<string, number>;
  canEdit: boolean;
}) {
  const toast = useToast();
  const [editing, setEditing] = React.useState<ClassroomRow | "new" | null>(null);
  const [deleting, setDeleting] = React.useState<ClassroomRow | null>(null);
  const [busy, setBusy] = React.useState(false);

  const teacherName = React.useCallback(
    (id: string | null) => teachers.find((teacher) => teacher.id === id)?.full_name ?? null,
    [teachers],
  );

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    const result = await deleteClassroomAction(deleting.id);
    setBusy(false);

    if (!result.ok) {
      toast.error("Couldn't remove the class", result.error);
      return;
    }
    toast.success(`Class ${deleting.name} removed`);
    setDeleting(null);
  }

  return (
    <>
      {canEdit ? (
        <div className="mt-5 flex justify-end">
          <Button onClick={() => setEditing("new")}>
            <Plus className="size-4" />
            Add class
          </Button>
        </div>
      ) : null}

      {classrooms.length === 0 ? (
        <EmptyState
          className="mt-6"
          icon={Users}
          title="No classes yet"
          description="Classes appear next to a student's name on the dismissal board, so staff know exactly where to look."
          action={
            canEdit ? (
              <Button onClick={() => setEditing("new")}>
                <Plus className="size-4" />
                Add the first class
              </Button>
            ) : null
          }
        />
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {classrooms.map((classroom) => (
            <li key={classroom.id} className="surface-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[17px] font-bold tracking-[-0.015em]">
                    {classroom.name}
                  </p>
                  <p className="truncate text-[13px] text-[var(--color-muted)]">
                    {classroom.grade || "No grade set"}
                  </p>
                </div>
                <span className="tabular shrink-0 rounded-lg bg-black/[0.06] px-2 py-1 text-[12px] font-bold dark:bg-white/[0.08]">
                  {studentCounts[classroom.id] ?? 0}
                </span>
              </div>

              <dl className="mt-3 space-y-1 text-[13px] text-[var(--color-muted)]">
                <div className="flex items-center gap-2">
                  <dt className="sr-only">Room</dt>
                  <DoorOpen className="size-3.5 shrink-0" />
                  <dd className="truncate">{classroom.room_number || "No room number"}</dd>
                </div>
                <div className="flex items-center gap-2">
                  <dt className="sr-only">Teacher</dt>
                  <Users className="size-3.5 shrink-0" />
                  <dd className="truncate">{teacherName(classroom.teacher_id) ?? "No teacher assigned"}</dd>
                </div>
              </dl>

              {canEdit ? (
                <div className="mt-3.5 flex gap-1.5">
                  <Button size="sm" variant="secondary" onClick={() => setEditing(classroom)}>
                    <Pencil className="size-3.5" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Remove class ${classroom.name}`}
                    className="ml-auto text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
                    onClick={() => setDeleting(classroom)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canEdit ? (
        <>
          <ClassroomModal
            key={editing === "new" ? "new" : (editing?.id ?? "closed")}
            open={editing !== null}
            classroom={editing === "new" ? null : editing}
            teachers={teachers}
            onClose={() => setEditing(null)}
          />

          <Modal
            open={deleting !== null}
            onClose={() => setDeleting(null)}
            title={deleting ? `Remove class ${deleting.name}?` : "Remove class"}
            description="Students in this class keep their records but lose their class assignment."
            size="sm"
            footer={
              <>
                <Button variant="secondary" onClick={() => setDeleting(null)}>
                  Keep class
                </Button>
                <Button variant="danger" onClick={confirmDelete} loading={busy}>
                  Remove class
                </Button>
              </>
            }
          >
            <p className="pb-2 text-sm text-[var(--color-muted)]">
              {deleting ? `${studentCounts[deleting.id] ?? 0} student(s) are in this class.` : ""}
            </p>
          </Modal>
        </>
      ) : null}
    </>
  );
}

function ClassroomModal({
  open,
  classroom,
  teachers,
  onClose,
}: {
  open: boolean;
  classroom: ClassroomRow | null;
  teachers: ProfileRow[];
  onClose: () => void;
}) {
  const toast = useToast();
  const [state, save, saving] = useActionState(saveClassroomAction, null);

  useEffect(() => {
    if (state?.ok) {
      toast.success(classroom ? "Class updated" : "Class added");
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={classroom ? "Edit class" : "Add a class"}
      description="Class names appear next to each student on the dismissal board."
      size="sm"
    >
      <form action={save} className="space-y-4 pb-2">
        {classroom ? <input type="hidden" name="id" value={classroom.id} /> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Class name" htmlFor="name" hint="e.g. 7B">
            <Input
              id="name"
              name="name"
              defaultValue={classroom?.name ?? ""}
              required
              maxLength={60}
              data-autofocus
            />
          </Field>
          <Field label="Grade" htmlFor="grade" hint="e.g. Grade 7">
            <Input id="grade" name="grade" defaultValue={classroom?.grade ?? ""} maxLength={40} />
          </Field>
        </div>

        <Field label="Room number" htmlFor="room_number">
          <Input
            id="room_number"
            name="room_number"
            defaultValue={classroom?.room_number ?? ""}
            maxLength={40}
          />
        </Field>

        <Field label="Teacher" htmlFor="teacher_id">
          <Select id="teacher_id" name="teacher_id" defaultValue={classroom?.teacher_id ?? ""}>
            <option value="">No teacher assigned</option>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.full_name}
              </option>
            ))}
          </Select>
        </Field>

        {state && !state.ok ? <ErrorMessage>{state.error}</ErrorMessage> : null}

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {classroom ? "Save changes" : "Add class"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
