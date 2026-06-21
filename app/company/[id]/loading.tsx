import { Skeleton, LoadingRegion, SkeletonCard } from "@/components/ui/Skeleton";

// Company profile: back link, header, then a 1.6fr / 1fr two-column body.
export default function CompanyLoading() {
  return (
    <LoadingRegion label="Loading company">
      <Skeleton className="h-4 w-28" />
      {/* header */}
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-md" />
          <div>
            <Skeleton className="h-6 w-56" />
            <Skeleton className="mt-2 h-4 w-64" />
          </div>
        </div>
        <Skeleton className="h-8 w-40" />
      </div>
      {/* two columns */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <SkeletonCard lines={4} />
          <SkeletonCard lines={5} />
          <SkeletonCard lines={3} />
        </div>
        <div className="space-y-6">
          <SkeletonCard lines={6} />
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
        </div>
      </div>
    </LoadingRegion>
  );
}
