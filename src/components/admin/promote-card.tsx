"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { GraduationCap, TriangleAlert } from "lucide-react";
import { promoteAllStudentsAction } from "@/lib/api/mutations";
import { useI18n } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Card, CardHeader, ErrorMessage } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

/**
 * End-of-year promotion. Destructive — Grade 12 is deleted — so it sits behind
 * a confirmation that spells out exactly what happens.
 */
export function PromoteCard() {
  const { t } = useI18n();
  const toast = useToast();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [skipped, setSkipped] = React.useState(0);

  async function confirm() {
    setBusy(true);
    setError(null);

    const result = await promoteAllStudentsAction();
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setOpen(false);
    setSkipped(result.data.skipped);
    toast.success(
      t("promote.done", { promoted: result.data.promoted }),
      t("promote.doneDetail", { graduated: result.data.graduated, skipped: result.data.skipped }),
    );
  }

  return (
    <>
      <Card>
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <GraduationCap className="size-4 text-[var(--color-muted)]" />
              {t("promote.title")}
            </span>
          }
          description={t("promote.body")}
        />
        <div className="px-5 pb-5">
          <Button variant="secondary" onClick={() => setOpen(true)}>
            <GraduationCap className="size-4" />
            {t("promote.button")}
          </Button>

          {skipped > 0 ? (
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[13px] font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-200"
            >
              {t("promote.skippedHint")}
            </motion.p>
          ) : null}
        </div>
      </Card>

      <Modal
        open={open}
        onClose={() => (busy ? undefined : setOpen(false))}
        title={t("promote.confirmTitle")}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              {t("common.cancel")}
            </Button>
            <Button variant="danger" onClick={confirm} loading={busy}>
              {t("promote.confirm")}
            </Button>
          </>
        }
      >
        <div className="space-y-3 pb-2">
          <p className="flex items-start gap-2.5 rounded-xl bg-rose-50 px-3.5 py-3 text-[13px] leading-relaxed text-rose-800 dark:bg-rose-500/10 dark:text-rose-200">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            {t("promote.confirmBody")}
          </p>
          {error ? <ErrorMessage>{error}</ErrorMessage> : null}
        </div>
      </Modal>
    </>
  );
}
