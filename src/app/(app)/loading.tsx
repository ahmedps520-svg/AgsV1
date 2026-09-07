import { QueueSkeleton, Skeleton } from "@/components/ui/primitives";

export default function AppLoading() {
  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 pt-5 sm:px-6 lg:px-8 lg:pt-8">
      <Skeleton className="h-9 w-52" />
      <Skeleton className="mt-2 h-4 w-72" />
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-[92px] rounded-2xl" />
        ))}
      </div>
      <div className="mt-5">
        <QueueSkeleton rows={4} />
      </div>
    </div>
  );
}
