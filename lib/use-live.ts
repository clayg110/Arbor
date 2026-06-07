"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasPublicSupabaseEnv } from "@/lib/supabase/env-client";

export type Source = "live" | "mock";

// Fetch live data with a mock fallback. `key` drives refetch (encode params in
// it). When `realtime`, also refetch on deal_stage_history inserts.
export function useLive<T>(
  key: string,
  fetcher: () => Promise<T>,
  fallback: T,
  opts: { realtime?: boolean } = {}
) {
  const [data, setData] = useState<T>(fallback);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<Source>("mock");

  const load = useCallback(async () => {
    try {
      const d = await fetcher();
      setData(d);
      setSource("live");
    } catch {
      setData(fallback);
      setSource("mock");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    if (!opts.realtime || !hasPublicSupabaseEnv()) return;
    const sb = createClient();
    const channel = sb
      .channel(`rt-${key}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "deal_stage_history" },
        () => load()
      )
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, opts.realtime]);

  return { data, loading, source, reload: load };
}
