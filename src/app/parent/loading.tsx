import { Skeleton } from "@/components/ui/primitives";

export default function ParentLoading() {
  return (
    <div className="mx-auto w-full max-w-lg px-4 pt-6">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="mt-2 h-4 w-72" />
      <Skeleton className="mt-6 h-44 rounded-2xl" />
      <Skeleton className="mt-4 h-3 w-28" />
      <div className="mt-3 space-y-2.5">
        <Skeleton className="h-[74px] rounded-2xl" />
        <Skeleton className="h-[74px] rounded-2xl" />
      </div>
    </div>
  );
}
