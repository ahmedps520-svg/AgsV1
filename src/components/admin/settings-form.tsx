"use client";

import * as React from "react";
import { useActionState, useEffect } from "react";
import { Building2, MonitorSpeaker, SlidersHorizontal } from "lucide-react";
import { updateSchoolAction } from "@/lib/api/mutations";
import { Button } from "@/components/ui/button";
import { Field, Input, Switch } from "@/components/ui/field";
import { Card, CardHeader, ErrorMessage } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import type { SchoolRow } from "@/lib/types/database";

export function SettingsForm({ school }: { school: SchoolRow }) {
  const toast = useToast();
  const [state, save, saving] = useActionState(updateSchoolAction, null);

  const [showQueuePosition, setShowQueuePosition] = React.useState(school.show_queue_position);
  const [showPickupNumber, setShowPickupNumber] = React.useState(school.show_pickup_number);
  const [allowParentCancel, setAllowParentCancel] = React.useState(school.allow_parent_cancel);

  useEffect(() => {
    if (state?.ok) toast.success("Settings saved", "Every connected device picks this up right away.");
  }, [state, toast]);

  return (
    <form action={save} className="mt-6 space-y-5">
      <input type="hidden" name="show_queue_position" value={showQueuePosition ? "on" : ""} />
      <input type="hidden" name="show_pickup_number" value={showPickupNumber ? "on" : ""} />
      <input type="hidden" name="allow_parent_cancel" value={allowParentCancel ? "on" : ""} />

      <Card>
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <Building2 className="size-4 text-[var(--color-muted)]" />
              School
            </span>
          }
          description="Shown on the dismissal board and in the parent app."
        />
        <div className="space-y-4 px-5 pb-5">
          <Field label="School name" htmlFor="name">
            <Input id="name" name="name" defaultValue={school.name} required maxLength={120} />
          </Field>

          <Field
            label="Timezone"
            htmlFor="timezone"
            hint="An IANA name such as Asia/Riyadh or America/New_York. All clocks and the dismissal date follow it."
          >
            <Input
              id="timezone"
              name="timezone"
              defaultValue={school.timezone}
              required
              maxLength={80}
              list="timezone-suggestions"
            />
          </Field>

          <datalist id="timezone-suggestions">
            {[
              "Asia/Riyadh",
              "Asia/Dubai",
              "Europe/London",
              "America/New_York",
              "America/Chicago",
              "America/Los_Angeles",
              "Asia/Singapore",
              "Australia/Sydney",
              "UTC",
            ].map((zone) => (
              <option key={zone} value={zone} />
            ))}
          </datalist>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Dismissal starts" htmlFor="dismissal_start">
              <Input
                id="dismissal_start"
                name="dismissal_start"
                type="time"
                defaultValue={school.dismissal_start?.slice(0, 5) ?? ""}
              />
            </Field>
            <Field label="Dismissal ends" htmlFor="dismissal_end">
              <Input
                id="dismissal_end"
                name="dismissal_end"
                type="time"
                defaultValue={school.dismissal_end?.slice(0, 5) ?? ""}
              />
            </Field>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <SlidersHorizontal className="size-4 text-[var(--color-muted)]" />
              Dismissal rules
            </span>
          }
          description="How much parents see, and what they can do themselves."
        />
        <div className="space-y-1 px-3 pb-4">
          <Switch
            checked={showQueuePosition}
            onChange={setShowQueuePosition}
            label="Show queue position to parents"
            description="Parents see “3rd of 12 in line” while they wait."
          />
          <Switch
            checked={showPickupNumber}
            onChange={setShowPickupNumber}
            label="Show pickup numbers"
            description="Displays the family's pickup number on cards and the dismissal board."
          />
          <Switch
            checked={allowParentCancel}
            onChange={setAllowParentCancel}
            label="Let parents cancel their own request"
            description="Only before the student has been called. Turn off if the office should handle all changes."
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <MonitorSpeaker className="size-4 text-[var(--color-muted)]" />
              Display board
            </span>
          }
          description="A short line shown along the bottom of the board and in the parent app."
        />
        <div className="px-5 pb-5">
          <Field label="Board message" htmlFor="board_message">
            <Input
              id="board_message"
              name="board_message"
              defaultValue={school.board_message ?? ""}
              maxLength={200}
              placeholder="Please stay in your vehicle until your student is walked out."
            />
          </Field>
        </div>
      </Card>

      {state && !state.ok ? <ErrorMessage>{state.error}</ErrorMessage> : null}

      <div className="flex justify-end">
        <Button type="submit" size="lg" loading={saving}>
          Save settings
        </Button>
      </div>
    </form>
  );
}
