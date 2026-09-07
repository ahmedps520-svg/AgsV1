"use client";

import * as React from "react";
import { useActionState, useEffect } from "react";
import Link from "next/link";
import { DoorOpen, LayoutGrid, Pencil, Plus, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { EmptyState, ErrorMessage } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/provider";
import { deleteClassroomAction, saveClassroomAction } from "@/lib/api/mutations";
import {
  ALL_LEVELS,
  classCode,
  classLabel,
  genderLabel,
  GRADE_SECTIONS,
  isKg,
  KG_SECTIONS,
  levelLabel,
  type ClassGender,
} from "@/lib/classes";
import { cn } from "@/lib/utils";
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
  const { t, locale } = useI18n();
  const toast = useToast();
  const [editing, setEditing] = React.useState<ClassroomRow | "new" | null>(null);
  const [deleting, setDeleting] = React.useState<ClassroomRow | null>(null);
  const [busy, setBusy] = React.useState(false);

  const teacherName = (id: string | null) =>
    teachers.find((teacher) => teacher.id === id)?.full_name ?? null;

  // Cards grouped by grade so 48 classes stay scannable.
  const groups = React.useMemo(() => {
    const map = new Map<string, ClassroomRow[]>();
    for (const room of classrooms) {
      const list = map.get(room.level) ?? [];
      list.push(room);
      map.set(room.level, list);
    }
    return [...map.entries()];
  }, [classrooms]);

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    const result = await deleteClassroomAction(deleting.id);
    setBusy(false);
    if (!result.ok) {
      toast.error(t("board.toast.failed"), result.error);
      return;
    }
    toast.success(t("classes.removed", { code: deleting.name }));
    setDeleting(null);
  }

  return (
    <>
      {canEdit ? (
        <div className="mt-5 flex justify-end">
          <Button onClick={() => setEditing("new")}>
            <Plus className="size-4" />
            {t("classes.addClass")}
          </Button>
        </div>
      ) : null}

      {classrooms.length === 0 ? (
        <EmptyState
          className="mt-6"
          icon={Users}
          title={t("classes.empty")}
          description={t("classes.emptyHint")}
          action={
            canEdit ? (
              <Button onClick={() => setEditing("new")}>
                <Plus className="size-4" />
                {t("classes.addClass")}
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="mt-4 space-y-8">
          {groups.map(([level, rooms]) => (
            <section key={level}>
              <h2 className="mb-2.5 text-[12px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
                {levelLabel(level, locale)}
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {rooms.map((room) => (
                  <li key={room.id} className="surface-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="code text-xl font-extrabold tracking-tight text-brand-700 dark:text-brand-300">
                          {room.name}
                        </p>
                        <p className="truncate text-[13px] text-[var(--color-muted)]">
                          {isKg(room.level) ? levelLabel(room.level, locale) : genderLabel(room.gender, locale)}
                          {" · "}
                          {t("classes.section")} {room.section}
                        </p>
                      </div>
                      <span className="tabular shrink-0 rounded-lg bg-black/[0.06] px-2 py-1 text-[12px] font-bold dark:bg-white/[0.08]">
                        {studentCounts[room.id] ?? 0}
                      </span>
                    </div>

                    <dl className="mt-3 space-y-1 text-[13px] text-[var(--color-muted)]">
                      <div className="flex items-center gap-2">
                        <dt className="sr-only">{t("classes.room")}</dt>
                        <DoorOpen className="size-3.5 shrink-0" />
                        <dd className="truncate">{room.room_number || t("classes.noRoom")}</dd>
                      </div>
                      <div className="flex items-center gap-2">
                        <dt className="sr-only">{t("classes.teacher")}</dt>
                        <Users className="size-3.5 shrink-0" />
                        <dd className="truncate">{teacherName(room.teacher_id) ?? t("classes.noTeacher")}</dd>
                      </div>
                    </dl>

                    <div className="mt-3.5 flex flex-wrap gap-1.5">
                      <Link
                        href={`/board/?c=${encodeURIComponent(room.name)}`}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-50 px-3 text-[13px] font-semibold text-brand-700 transition hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-200"
                      >
                        <LayoutGrid className="size-3.5" />
                        {t("classes.openBoard")}
                      </Link>
                      {canEdit ? (
                        <>
                          <Button size="sm" variant="secondary" onClick={() => setEditing(room)}>
                            <Pencil className="size-3.5" />
                            {t("common.edit")}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={t("classes.removeTitle", { code: room.name })}
                            className="ms-auto text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
                            onClick={() => setDeleting(room)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
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
            title={deleting ? t("classes.removeTitle", { code: deleting.name }) : ""}
            description={t("classes.removeBody")}
            size="sm"
            footer={
              <>
                <Button variant="secondary" onClick={() => setDeleting(null)}>
                  {t("classes.keep")}
                </Button>
                <Button variant="danger" onClick={confirmDelete} loading={busy}>
                  {t("common.remove")}
                </Button>
              </>
            }
          >
            <p className="pb-2 text-sm text-[var(--color-muted)]">
              {deleting ? t("classes.removeCount", { count: studentCounts[deleting.id] ?? 0 }) : ""}
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
  const { t, locale } = useI18n();
  const toast = useToast();
  const [state, save, saving] = useActionState(saveClassroomAction, null);

  const [level, setLevel] = React.useState(classroom?.level ?? "1");
  const [gender, setGender] = React.useState<ClassGender>(classroom?.gender ?? "boys");
  const [section, setSection] = React.useState(classroom?.section ?? "1");

  const kg = isKg(level);
  const sections = kg ? KG_SECTIONS : GRADE_SECTIONS;
  const effectiveGender: ClassGender = kg ? "mixed" : gender === "girls" ? "girls" : "boys";
  const effectiveSection = sections.includes(section as never) ? section : sections[0];
  const preview = classCode({ level, gender: effectiveGender, section: effectiveSection });

  useEffect(() => {
    if (state?.ok) {
      toast.success(t(classroom ? "classes.updated" : "classes.added"));
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t(classroom ? "classes.editTitle" : "classes.addTitle")}
      description={classLabel({ level, gender: effectiveGender, section: effectiveSection }, locale)}
      size="sm"
    >
      <form action={save} className="space-y-4 pb-2">
        {classroom ? <input type="hidden" name="id" value={classroom.id} /> : null}
        <input type="hidden" name="gender" value={effectiveGender} />
        <input type="hidden" name="section" value={effectiveSection} />

        <Field label={t("classes.level")} htmlFor="level">
          <Select id="level" name="level" value={level} onChange={(event) => setLevel(event.target.value)}>
            {ALL_LEVELS.map((value) => (
              <option key={value} value={value}>
                {levelLabel(value, locale)}
              </option>
            ))}
          </Select>
        </Field>

        {!kg ? (
          <div>
            <p className="mb-1.5 block text-[13px] font-medium">{t("classes.gender")}</p>
            <div className="grid grid-cols-2 gap-2">
              {(["boys", "girls"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setGender(value)}
                  className={cn(
                    "rounded-xl px-3 py-2.5 text-sm font-semibold ring-1 ring-inset transition",
                    effectiveGender === value
                      ? "bg-brand-600 text-white ring-brand-600"
                      : "bg-[var(--color-surface)] ring-[var(--color-hairline)]",
                  )}
                >
                  {genderLabel(value, locale)}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div>
          <p className="mb-1.5 block text-[13px] font-medium">{t("classes.section")}</p>
          <div className="flex flex-wrap gap-2">
            {sections.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setSection(value)}
                className={cn(
                  "tabular min-w-11 rounded-xl px-3 py-2 text-sm font-semibold ring-1 ring-inset transition",
                  effectiveSection === value
                    ? "bg-brand-600 text-white ring-brand-600"
                    : "bg-[var(--color-surface)] ring-[var(--color-hairline)]",
                )}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        <p className="rounded-xl bg-black/[0.03] px-3.5 py-2.5 text-[13px] dark:bg-white/[0.05]">
          {t("classes.code")}:{" "}
          <span className="code text-base font-extrabold text-brand-700 dark:text-brand-300">{preview}</span>
        </p>

        <Field label={t("classes.room")} htmlFor="room_number">
          <Input id="room_number" name="room_number" defaultValue={classroom?.room_number ?? ""} maxLength={40} />
        </Field>

        <Field label={t("classes.teacher")} htmlFor="teacher_id">
          <Select id="teacher_id" name="teacher_id" defaultValue={classroom?.teacher_id ?? ""}>
            <option value="">{t("classes.noTeacher")}</option>
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
            {t("common.cancel")}
          </Button>
          <Button type="submit" loading={saving}>
            {t(classroom ? "common.saveChanges" : "classes.addClass")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
