"use client";

import { useActionState, useEffect } from "react";
import { KeyRound, UserRound } from "lucide-react";
import { updateOwnProfileAction, updatePasswordAction } from "@/lib/api/mutations";
import { useI18n } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Card, CardHeader, ErrorMessage } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

export function AccountForms({
  fullName,
  phone,
  vehicle,
  showVehicle,
}: {
  fullName: string;
  phone: string | null;
  vehicle: string | null;
  showVehicle: boolean;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [profileState, saveProfile, savingProfile] = useActionState(updateOwnProfileAction, null);
  const [passwordState, savePassword, savingPassword] = useActionState(updatePasswordAction, null);

  useEffect(() => {
    if (profileState?.ok) toast.success(t("account.saved"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileState]);

  useEffect(() => {
    if (passwordState?.ok) toast.success(t("account.passwordUpdated"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passwordState]);

  return (
    <div className="mt-8 space-y-5">
      <Card>
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <UserRound className="size-4 text-[var(--color-muted)]" />
              {t("account.details")}
            </span>
          }
          description={showVehicle ? t("account.detailsHint") : undefined}
        />
        <form action={saveProfile} className="space-y-4 px-5 pb-5">
          <Field label={t("account.fullName")} htmlFor="full_name">
            <Input id="full_name" name="full_name" defaultValue={fullName} required maxLength={120} />
          </Field>
          <Field label={t("account.phone")} htmlFor="phone" hint={t("account.phoneHint")}>
            <Input id="phone" name="phone" type="tel" defaultValue={phone ?? ""} maxLength={40} dir="ltr" />
          </Field>
          {showVehicle ? (
            <Field label={t("account.vehicle")} htmlFor="vehicle_description" hint={t("account.vehicleHint")}>
              <Input id="vehicle_description" name="vehicle_description" defaultValue={vehicle ?? ""} maxLength={120} />
            </Field>
          ) : null}
          {profileState && !profileState.ok ? <ErrorMessage>{profileState.error}</ErrorMessage> : null}
          <Button type="submit" loading={savingProfile}>
            {t("account.saveDetails")}
          </Button>
        </form>
      </Card>

      <Card>
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <KeyRound className="size-4 text-[var(--color-muted)]" />
              {t("account.password")}
            </span>
          }
          description={t("account.passwordHint")}
        />
        <form action={savePassword} className="space-y-4 px-5 pb-5">
          <Field label={t("account.newPassword")} htmlFor="password">
            <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} dir="ltr" />
          </Field>
          <Field label={t("account.confirmPassword")} htmlFor="confirm">
            <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} dir="ltr" />
          </Field>
          {passwordState && !passwordState.ok ? <ErrorMessage>{passwordState.error}</ErrorMessage> : null}
          <Button type="submit" variant="secondary" loading={savingPassword}>
            {t("account.updatePassword")}
          </Button>
        </form>
      </Card>
    </div>
  );
}
