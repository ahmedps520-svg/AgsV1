"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useRequireRole } from "@/components/auth/require-role";
import { ClassPicker } from "@/components/board/class-picker";
import { ClassBoard } from "@/components/board/class-board";
import { BootScreen } from "@/components/boot-screen";

export default function BoardPage() {
  return (
    <Suspense fallback={<BootScreen />}>
      <BoardScreen />
    </Suspense>
  );
}

function BoardScreen() {
  const { session, ready } = useRequireRole(["admin", "staff", "display"]);
  const params = useSearchParams();
  const code = params.get("c");

  if (!ready || !session?.school) return <BootScreen />;

  return code ? <ClassBoard session={session} code={code} /> : <ClassPicker session={session} />;
}
