import { cn } from "@/lib/utils";
import { STATUS_META } from "@/lib/dismissal";
import { Badge } from "@/components/ui/primitives";
import type { DismissalStatus } from "@/lib/types/database";

export function StatusBadge({
  status,
  audience = "staff",
  className,
}: {
  status: DismissalStatus;
  audience?: "staff" | "parent";
  className?: string;
}) {
  const meta = STATUS_META[status];
  return (
    <Badge className={cn(meta.soft, className)}>
      <span className={cn("size-1.5 rounded-full", meta.dot)} aria-hidden />
      {audience === "parent" ? meta.parentLabel : meta.label}
    </Badge>
  );
}
