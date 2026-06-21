import { Skeleton, LoadingRegion, SkeletonCardGrid } from "@/components/ui/Skeleton";

export default function DealsLoading() {
  return (
    <LoadingRegion label="Loading deal rooms">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="mt-2 h-3 w-96" />
      {/* filter segmented control */}
      <Skeleton className="mt-5 h-9 w-72" />
      <div className="mt-5">
        <SkeletonCardGrid count={6} lines={4} />
      </div>
    </LoadingRegion>
  );
}
