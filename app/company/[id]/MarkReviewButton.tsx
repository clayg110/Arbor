"use client";

import { useState } from "react";

export function MarkReviewButton({ flagged }: { flagged: boolean }) {
  const [done, setDone] = useState(flagged);
  return (
    <button
      type="button"
      onClick={() => setDone(true)}
      disabled={done}
      className="rounded-md px-3 py-1.5 text-[12px] font-medium disabled:opacity-60"
      style={{ backgroundColor: "#FCEBEB", color: "#791F1F" }}
    >
      {done ? "Flagged for review" : "Mark for review"}
    </button>
  );
}
