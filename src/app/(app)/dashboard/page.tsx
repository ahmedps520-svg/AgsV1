"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { BootScreen } from "@/components/boot-screen";

/** The old queue dashboard is gone: every class has its own board now. */
export default function DashboardRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/board/");
  }, [router]);
  return <BootScreen />;
}
