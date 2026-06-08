import { describe, it, expect } from "vitest";
import { toNotificationRows } from "@/lib/notifications";
import type { UserDigest } from "@/lib/digest";

describe("toNotificationRows", () => {
  it("maps each user's items to notification rows with a dedupe key", () => {
    const digests: UserDigest[] = [
      {
        userId: "u1",
        items: [
          {
            companyId: "c1",
            companyName: "Acme",
            action: "Moved to In market",
            at: "t1",
          },
          { companyId: "c2", companyName: "Globex", action: "Process pulled", at: "t2" },
        ],
      },
    ];
    const rows = toNotificationRows(digests);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      user_id: "u1",
      type: "watchlist",
      title: "Acme",
      body: "Moved to In market",
      entity_type: "company",
      entity_id: "c1",
      dedupe_key: "u1:c1:t1",
    });
  });

  it("returns [] for no digests", () => {
    expect(toNotificationRows([])).toEqual([]);
  });
});
