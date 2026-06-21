import { PageSkeleton } from "@/components/ui/Skeleton";

export default function FeedLoading() {
  return <PageSkeleton cards={5} lines={3} />;
}
