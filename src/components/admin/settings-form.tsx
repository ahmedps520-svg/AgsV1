"use client";

import * as React from "react";
import { useActionState, useEffect } from "react";
import { Building2, SlidersHorizontal } from "lucide-react";
import { updateSchoolAction } from "@/lib/api/mutations";
import { useI18n } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { Field, Input, Switch } from "@/components/ui/field";
import { Card, CardHeader, ErrorMessage } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import type { SchoolRow } from "@/lib/types/database";

export function SettingsForm({ school }: { school: SchoolRow }) {
  const { t } = useI18n();
  const toast = useToast();
  const [state, save, saving] = useActionState(updateSchoolAction, null);
  const [allowParentCancel, setAllowParentCancel] = React.useState(school.allow_parent_cancel);

  useEffect(() => {
    if (state?.ok) toast.success(t("settings.saved"), t("settings.savedBody"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={save} className="mt-6 space-y-5">
      <input type="hidden" name="allow_parent_cancel" value={allowParentCancel ? "on" : ""} />

      <Card>
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <Building2 className="size-4 text-[var(--color-muted)]" />
              {t("settings.school")}
            </span>
          }
          description={t("settings.schoolHint")}
        />
        <div className="space-y-4 px-5 pb-5">
          <Field label={t("settings.schoolName")} htmlFor="name">
            <Input id="name" name="name" defaultValue={school.name} required maxLength={120} />
          </Field>

          <Field label={t("settings.timezone")} htmlFor="timezone" hint={t("settings.timezoneHint")}>
            <Input id="timezone" name="timezone" defaultValue={school.timezone} required maxLength={80} list="timezone-suggestions" dir="ltr" />
          </Field>
          <datalist id="timezone-suggestions">
            {["Asia/Riyadh", "Asia/Dubai", "Asia/Kuwait", "Asia/Bahrain", "Asia/Qatar", "Africa/Cairo", "Europe/London", "UTC"].map((zone) => (
              <option key={zone} value={zone} />
            ))}
          </datalist>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("settings.dismissalStart")} htmlFor="dismissal_start">
              <Input id="dismissal_start" name="dismissal_start" type="time" defaultValue={school.dismissal_start?.slice(0, 5) ?? ""} dir="ltr" />
            </Field>
            <Field label={t("settings.dismissalEnd")} htmlFor="dismissal_end">
              <Input id="dismissal_end" name="dismissal_end" type="time" defaultValue={school.dismissal_end?.slice(0, 5) ?? ""} dir="ltr" />
            </Field>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <SlidersHorizontal className="size-4 text-[var(--color-muted)]" />
              {t("settings.rules")}
            </span>
          }
          description={t("settings.rulesHint")}
        />
        <div className="space-y-1 px-3 pb-2">
          <Switch
            checked={allowParentCancel}
            onChange={setAllowParentCancel}
            label={t("settings.parentCancel")}
            description={t("settings.parentCancelHint")}
          />
        </div>
        <div className="px-5 pb-5">
          <Field label={t("settings.boardMessage")} htmlFor="board_message">
            <Input id="board_message" name="board_message" defaultValue={school.board_message ?? ""} maxLength={200} placeholder={t("settings.boardMessagePlaceholder")} />
          </Field>
        </div>
      </Card>

      {state && !state.ok ? <ErrorMessage>{state.error}</ErrorMessage> : null}

      <div className="flex justify-end">
        <Button type="submit" size="lg" loading={saving}>
          {t("common.save")}
        </Button>
      </div>
    </form>
  );
}
