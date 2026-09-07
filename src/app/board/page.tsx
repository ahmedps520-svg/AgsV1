"use client";

import { useCallback } from "react";
import { useRequireRole } from "@/components/auth/require-role";
import { getQueue, schoolToday } from "@/lib/api/queries";
import { useLoad } from "@/lib/api/use-load";
import { BoardClient } from "@/components/board/board-client";
import { BootScreen } from "@/components/boot-screen";

export default function BoardPage() {
  const { session, ready } = useRequireRole(["admin", "staff", "display"]);
  const school = session?.school ?? null;
  const today = school ? schoolToday(school.timezone) : "";

  const load = useCallback(async () => {
    if (!school) return [];
    try {
      return await getQueue(school.id, today);
    } catch {
      // The board must come up even if the first read fails; the live hook
      // retries on connect and on a timer after that.
      return [];
    }
  }, [school, today]);

  const { data, loading } = useLoad(load, ready && Boolean(school));

  if (!ready || !school || (loading && !data)) {
    return (
      <div className="board-root min-h-dvh">
        <BootScreen label="Starting the dismissal board…" />
      </div>
    );
  }

  return <BoardClient school={school} initialQueue={data ?? []} today={today} />;
}
