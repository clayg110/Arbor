"use client";

import { useState } from "react";
import { api, BackendOff } from "@/lib/api-client";

export function MarkReviewButton({
  companyId,
  flagged,
}: {
  companyId: string;
  flagged: boolean;
}) {
  const [done, setDone] = useState(flagged);

  function mark() {
    setDone(true); // optimistic
    api.markReview(companyId).catch((e) => {
      if (!(e instanceof BackendOff)) setDone(false); // revert real error
    });
  }

  return (
    <button
      type="button"
      onClick={mark}
      disabled={done}
      className="rounded-md px-3 py-1.5 text-[12px] font-medium disabled:opacity-60"
      style={{ backgroundColor: "#FCEBEB", color: "#791F1F" }}
    >
      {done ? "Flagged for review" : "Mark for review"}
    </button>
  );
}
