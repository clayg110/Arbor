import { Skeleton, LoadingRegion, SkeletonCard } from "@/components/ui/Skeleton";

export default function DealRoomLoading() {
  return (
    <LoadingRegion label="Loading deal room">
      <Skeleton className="h-4 w-32" />
      {/* header */}
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Skeleton className="h-7 w-64" />
          <Skeleton className="mt-2 h-3 w-40" />
          <Skeleton className="mt-2 h-5 w-72" />
        </div>
        <Skeleton className="h-8 w-36" />
      </div>
      {/* attention banner */}
      <Skeleton className="mt-6 h-12 w-full" />
      {/* layer cards */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} lines={4} />
        ))}
      </div>
    </LoadingRegion>
  );
}
