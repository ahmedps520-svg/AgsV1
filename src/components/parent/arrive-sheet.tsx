"use client";

import * as React from "react";
import { Check, Hand } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Avatar, ErrorMessage } from "@/components/ui/primitives";
import { requestDismissalAction } from "@/server/actions/dismissal";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { GuardianStudent } from "@/server/queries/dismissal";

export function ArriveSheet({
  open,
  onClose,
  students,
  defaultVehicle,
  activeStudentIds,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  students: GuardianStudent[];
  defaultVehicle: string | null;
  activeStudentIds: Set<string>;
  onDone: () => void;
}) {
  const toast = useToast();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [vehicle, setVehicle] = React.useState(defaultVehicle ?? "");
  const [note, setNote] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const selectable = students.filter(
    (link) => link.can_pickup && link.student && !activeStudentIds.has(link.student.id),
  );

  // Preselect everyone who isn't already in the queue — the common case is
  // "I'm here for all my children". Done as a state adjustment on open rather
  // than in an effect, so the first paint already shows the right selection.
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setSelected(new Set(selectable.map((link) => link.student!.id)));
      setVehicle(defaultVehicle ?? "");
      setNote("");
      setError(null);
    }
  }

  function toggle(studentId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  async function submit() {
    if (selected.size === 0) {
      setError("Choose at least one student.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await requestDismissalAction({
      studentIds: [...selected],
      note: note.trim() || undefined,
      vehicle: vehicle.trim() || undefined,
    });

    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    toast.success(
      selected.size === 1 ? "The school knows you're here" : "The school knows you're here",
      "Staff will call your student shortly.",
    );
    onDone();
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      variant="sheet"
      title="Who are you picking up?"
      description="Tap to select, then let the school know you've arrived."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Not yet
          </Button>
          <Button size="lg" onClick={submit} loading={submitting} disabled={selected.size === 0}>
            <Hand className="size-4" />
            I&apos;m here
            {selected.size > 0 ? ` · ${selected.size}` : ""}
          </Button>
        </>
      }
    >
      <div className="space-y-2 pb-1">
        {selectable.length === 0 ? (
          <p className="rounded-xl bg-emerald-50 px-4 py-3.5 text-sm font-medium text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">
            All of your students are already in today&apos;s queue.
          </p>
        ) : (
          selectable.map((link) => {
            const student = link.student!;
            const name = `${student.first_name} ${student.last_name}`.trim();
            const isSelected = selected.has(student.id);

            return (
              <button
                key={student.id}
                type="button"
                onClick={() => toggle(student.id)}
                aria-pressed={isSelected}
                className={cn(
                  "flex w-full items-center gap-3.5 rounded-2xl p-3.5 text-left transition",
                  isSelected
                    ? "bg-brand-50 ring-2 ring-brand-600 dark:bg-brand-500/15"
                    : "bg-black/[0.03] ring-1 ring-inset ring-[var(--color-hairline)] dark:bg-white/[0.04]",
                )}
              >
                <Avatar name={name} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{name}</span>
                  <span className="block truncate text-[13px] text-[var(--color-muted)]">
                    {[student.grade, student.classroom?.name ? `Class ${student.classroom.name}` : null]
                      .filter(Boolean)
                      .join(" — ")}
                  </span>
                </span>
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition",
                    isSelected
                      ? "border-brand-600 bg-brand-600 text-white"
                      : "border-black/15 dark:border-white/20",
                  )}
                >
                  {isSelected ? <Check className="size-3.5" strokeWidth={3.5} /> : null}
                </span>
              </button>
            );
          })
        )}
      </div>

      {selectable.length > 0 ? (
        <div className="mt-4 space-y-3.5 pb-2">
          <Field
            label="Your vehicle"
            hint="Helps staff spot you in the pickup line."
            htmlFor="vehicle"
          >
            <Input
              id="vehicle"
              value={vehicle}
              onChange={(event) => setVehicle(event.target.value)}
              placeholder="White SUV · ABC 1234"
              maxLength={120}
            />
          </Field>

          <Field label="Message for the office (optional)" htmlFor="note">
            <Textarea
              id="note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Running a little late — parked in bay 3"
              maxLength={280}
              className="min-h-20"
            />
          </Field>

          {error ? <ErrorMessage>{error}</ErrorMessage> : null}
        </div>
      ) : null}
    </Modal>
  );
}
