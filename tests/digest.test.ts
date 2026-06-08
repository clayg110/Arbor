import { describe, it, expect } from "vitest";
import { buildUserDigests, digestEmail, type DigestChange } from "@/lib/digest";

const changes: DigestChange[] = [
  { companyId: "c1", companyName: "Acme", action: "Moved to In market", at: "t1" },
  { companyId: "c2", companyName: "Globex", action: "Process pulled", at: "t2" },
];

describe("buildUserDigests", () => {
  it("gives each user only their watched companies that changed", () => {
    const wl = [
      { user_id: "u1", company_id: "c1" }, // watches a changed company
      { user_id: "u2", company_id: "c1" },
      { user_id: "u2", company_id: "c9" }, // c9 didn't change → ignored
      { user_id: "u3", company_id: "c9" }, // only watches an unchanged company
    ];
    const digests = buildUserDigests(changes, wl);
    const byUser = Object.fromEntries(digests.map((d) => [d.userId, d.items]));
    expect(Object.keys(byUser).sort()).toEqual(["u1", "u2"]);
    expect(byUser.u1.map((i) => i.companyId)).toEqual(["c1"]);
    expect(byUser.u2.map((i) => i.companyId)).toEqual(["c1"]);
    expect(byUser.u3).toBeUndefined();
  });

  it("returns nothing when no watched company changed", () => {
    expect(buildUserDigests(changes, [{ user_id: "u", company_id: "zzz" }])).toEqual([]);
  });
});

describe("digestEmail", () => {
  it("counts updates + links each company and the watchlist", () => {
    const { subject, html } = digestEmail({ items: changes, appUrl: "https://app" });
    expect(subject).toBe("Arbor: 2 updates on your watchlist");
    expect(html).toContain("https://app/company/c1");
    expect(html).toContain("Acme");
    expect(html).toContain("https://app/watchlist");
  });

  it("uses singular for one update + escapes html in names", () => {
    const { subject, html } = digestEmail({
      items: [{ companyId: "c", companyName: "A & <B>", action: "x", at: "t" }],
      appUrl: "https://app",
    });
    expect(subject).toBe("Arbor: 1 update on your watchlist");
    expect(html).toContain("A &amp; &lt;B&gt;");
  });
});
