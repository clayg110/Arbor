"use client";

import { useEffect, useRef, useState } from "react";
import { SearchIcon } from "./icons";

export function SearchBar({
  onSearch,
  placeholder = "Search companies…",
  className,
}: {
  onSearch: (q: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [value, setValue] = useState("");
  const cb = useRef(onSearch);
  cb.current = onSearch;

  useEffect(() => {
    const t = setTimeout(() => cb.current(value.trim()), 300);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <div
      className={`flex items-center gap-2 rounded-md bg-surface px-2.5 py-1.5 ${className ?? ""}`}
      style={{ border: "0.5px solid var(--border)" }}
    >
      <SearchIcon className="h-4 w-4 text-subtle" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-[13px] font-normal text-ink placeholder:text-subtle focus:outline-none"
      />
    </div>
  );
}
