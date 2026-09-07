"use client";

import * as React from "react";
import { Check, Hash, Search, UserPlus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Avatar, EmptyState } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { addToQueueAction } from "@/server/actions/dismissal";
import { cn } from "@/lib/utils";
import type { StudentWithClassroom } from "@/server/queries/dismissal";

export function AddToQueueModal({
  open,
  onClose,
  students,
  activeStudentIds,
  showPickupNumber,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  students: StudentWithClassroom[];
  activeStudentIds: Set<string>;
  showPickupNumber: boolean;
  onAdded: () => void;
}) {
  const toast = useToast();
  const [term, setTerm] = React.useState("");
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  // Reset the search each time the dialog opens (state adjustment on prop
  // change — cheaper and more predictable than an effect).
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setTerm("");
  }

  const results = React.useMemo(() => {
    const needle = term.trim().toLowerCase();
    const pool = students.filter((student) => student.is_active);
    if (!needle) return pool.slice(0, 60);

    return pool
      .filter((student) => {
        const haystack = [
          student.first_name,
          student.last_name,
          student.grade,
          student.classroom?.name,
          student.pickup_number,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(needle);
      })
      .slice(0, 60);
  }, [students, term]);

  async function add(student: StudentWithClassroom) {
    setPendingId(student.id);
    const result = await addToQueueAction({ studentId: student.id });
    setPendingId(null);

    if (!result.ok) {
      toast.error("Couldn't add to the queue", result.error);
      return;
    }

    toast.success(`${student.first_name} added to the queue`);
    onAdded();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a student to the queue"
      description="Use this when a parent arrives without the app, or a student is ready early."
      size="md"
    >
      <div className="sticky top-0 z-10 -mx-1 bg-[var(--color-surface)] pb-3 pt-1">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--color-muted)]" />
          <Input
            data-autofocus
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search by name, grade, class or pickup number"
            className="pl-10"
            aria-label="Search students"
          />
        </div>
      </div>

      {results.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No students match that search"
          description="Try a first name, a class like 7B, or a pickup number."
          className="my-2"
        />
      ) : (
        <ul className="space-y-1 pb-2">
          {results.map((student) => {
            const inQueue = activeStudentIds.has(student.id);
            const name = `${student.first_name} ${student.last_name}`.trim();

            return (
              <li key={student.id}>
                <button
                  type="button"
                  disabled={inQueue || pendingId !== null}
                  onClick={() => add(student)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition",
                    inQueue
                      ? "cursor-default opacity-55"
                      : "hover:bg-black/[0.04] dark:hover:bg-white/[0.06]",
                    pendingId === student.id && "opacity-60",
                  )}
                >
                  <Avatar name={name} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{name}</span>
                    <span className="block truncate text-[12.5px] text-[var(--color-muted)]">
                      {[student.grade, student.classroom?.name ? `Class ${student.classroom.name}` : null]
                        .filter(Boolean)
                        .join(" — ") || "No class assigned"}
                    </span>
                  </span>

                  {showPickupNumber && student.pickup_number ? (
                    <span className="tabular inline-flex shrink-0 items-center gap-0.5 rounded-md bg-black/[0.06] px-1.5 py-0.5 text-[12px] font-bold dark:bg-white/[0.1]">
                      <Hash className="size-3 opacity-60" />
                      {student.pickup_number}
                    </span>
                  ) : null}

                  {inQueue ? (
                    <span className="inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-emerald-600 dark:text-emerald-400">
                      <Check className="size-3.5" />
                      In queue
                    </span>
                  ) : (
                    <UserPlus className="size-4 shrink-0 text-[var(--color-muted)]" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="pb-1 pt-1">
        <Button variant="secondary" className="w-full sm:hidden" onClick={onClose}>
          Done
        </Button>
      </div>
    </Modal>
  );
}
