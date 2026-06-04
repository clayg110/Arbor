"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangleIcon } from "@/components/ui/icons";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div
        className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FCEBEB]"
        style={{ border: "0.5px solid var(--border)" }}
      >
        <AlertTriangleIcon className="h-6 w-6 text-[#791F1F]" />
      </div>
      <h1 className="mt-4 text-[16px] font-medium text-ink">Something went wrong</h1>
      <p className="mt-1 max-w-md text-[13px] font-normal text-muted">
        An unexpected error occurred while rendering this page.
        {error.digest && <span className="block text-[11px] text-subtle">Ref: {error.digest}</span>}
      </p>
      <div className="mt-5 flex items-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-md px-3 py-1.5 text-[13px] font-medium text-white"
          style={{ backgroundColor: "#185FA5" }}
        >
          Try again
        </button>
        <Link
          href="/radar"
          className="rounded-md px-3 py-1.5 text-[13px] font-medium text-ink"
          style={{ border: "0.5px solid var(--border)" }}
        >
          Back to radar
        </Link>
      </div>
    </div>
  );
}
