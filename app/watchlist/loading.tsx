import { PageSkeleton } from "@/components/ui/Skeleton";

export default function WatchlistLoading() {
  return <PageSkeleton cards={6} lines={2} />;
}
