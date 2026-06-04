import Link from "next/link";
import { InboxIcon } from "@/components/ui/icons";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <InboxIcon className="h-12 w-12 text-subtle" />
      <h1 className="mt-4 text-[16px] font-medium text-ink">Page not found</h1>
      <p className="mt-1 text-[13px] font-normal text-muted">
        The page you&apos;re looking for doesn&apos;t exist or has moved.
      </p>
      <Link
        href="/radar"
        className="mt-5 rounded-md px-3 py-1.5 text-[13px] font-medium text-white"
        style={{ backgroundColor: "#185FA5" }}
      >
        Back to radar
      </Link>
    </div>
  );
}
