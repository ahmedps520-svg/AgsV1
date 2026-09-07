import { requireBoardViewer } from "@/server/session";
import { getQueue, schoolToday } from "@/server/queries/dismissal";
import { BoardClient } from "@/components/board/board-client";

export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const session = await requireBoardViewer("/board");
  const school = session.school!;
  const today = schoolToday(school.timezone);

  let queue = [] as Awaited<ReturnType<typeof getQueue>>;
  try {
    queue = await getQueue(school.id, today);
  } catch {
    // The board must come up even if the first read fails — the Realtime hook
    // retries on connect and every 20 seconds after that.
  }

  return <BoardClient school={school} initialQueue={queue} today={today} />;
}
