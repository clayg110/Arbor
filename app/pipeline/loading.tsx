import { PageSkeleton } from "@/components/ui/Skeleton";

export default function PipelineLoading() {
  return <PageSkeleton cards={6} lines={4} />;
}
