"use client";

import { useActionState, useEffect } from "react";
import { KeyRound, UserRound } from "lucide-react";
import { updateOwnProfileAction } from "@/server/actions/settings";
import { updatePasswordAction } from "@/server/actions/auth";
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
  const toast = useToast();
  const [profileState, saveProfile, savingProfile] = useActionState(updateOwnProfileAction, null);
  const [passwordState, savePassword, savingPassword] = useActionState(updatePasswordAction, null);

  useEffect(() => {
    if (profileState?.ok) toast.success("Details saved");
  }, [profileState, toast]);

  useEffect(() => {
    if (passwordState?.ok) toast.success("Password updated");
  }, [passwordState, toast]);

  return (
    <div className="mt-8 space-y-5">
      <Card>
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <UserRound className="size-4 text-[var(--color-muted)]" />
              Your details
            </span>
          }
          description="Staff see this when you arrive for pickup."
        />
        <form action={saveProfile} className="space-y-4 px-5 pb-5">
          <Field label="Full name" htmlFor="full_name">
            <Input id="full_name" name="full_name" defaultValue={fullName} required maxLength={120} />
          </Field>

          <Field label="Phone" htmlFor="phone" hint="Optional — used by the office if they need you.">
            <Input id="phone" name="phone" type="tel" defaultValue={phone ?? ""} maxLength={40} />
          </Field>

          {showVehicle ? (
            <Field
              label="Vehicle"
              htmlFor="vehicle_description"
              hint="Pre-filled when you tap “I'm Here”."
            >
              <Input
                id="vehicle_description"
                name="vehicle_description"
                defaultValue={vehicle ?? ""}
                placeholder="White SUV · ABC 1234"
                maxLength={120}
              />
            </Field>
          ) : null}

          {profileState && !profileState.ok ? (
            <ErrorMessage>{profileState.error}</ErrorMessage>
          ) : null}

          <Button type="submit" loading={savingProfile}>
            Save details
          </Button>
        </form>
      </Card>

      <Card>
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <KeyRound className="size-4 text-[var(--color-muted)]" />
              Password
            </span>
          }
          description="At least 8 characters."
        />
        <form action={savePassword} className="space-y-4 px-5 pb-5">
          <Field label="New password" htmlFor="password">
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
            />
          </Field>

          <Field label="Confirm new password" htmlFor="confirm">
            <Input
              id="confirm"
              name="confirm"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
            />
          </Field>

          {passwordState && !passwordState.ok ? (
            <ErrorMessage>{passwordState.error}</ErrorMessage>
          ) : null}

          <Button type="submit" variant="secondary" loading={savingPassword}>
            Update password
          </Button>
        </form>
      </Card>
    </div>
  );
}
