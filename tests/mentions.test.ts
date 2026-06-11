import { describe, it, expect } from "vitest";
import {
  nameToHandle,
  extractMentionHandles,
  resolveHandles,
  type OrgMember,
} from "@/lib/mentions";

describe("nameToHandle", () => {
  it("lowercases and joins spaces with underscores", () => {
    expect(nameToHandle("John Smith")).toBe("john_smith");
  });
  it("strips non-alphanumeric chars (except . _ -)", () => {
    expect(nameToHandle("O'Brien")).toBe("obrien");
  });
  it("handles single-word names unchanged", () => {
    expect(nameToHandle("alice")).toBe("alice");
  });
  it("collapses multiple consecutive spaces into one underscore", () => {
    expect(nameToHandle("Mary  Jane")).toBe("mary_jane");
  });
});

describe("extractMentionHandles", () => {
  it("extracts single mention", () => {
    expect(extractMentionHandles("Hey @alice, call today?")).toEqual(["alice"]);
  });
  it("extracts multiple distinct mentions", () => {
    const result = extractMentionHandles("@alice and @bob please review");
    expect(result).toContain("alice");
    expect(result).toContain("bob");
    expect(result).toHaveLength(2);
  });
  it("deduplicates repeated mentions", () => {
    expect(extractMentionHandles("@alice @alice @alice")).toEqual(["alice"]);
  });
  it("returns empty array for text without mentions", () => {
    expect(extractMentionHandles("no mentions here")).toEqual([]);
  });
  it("lowercases extracted handles", () => {
    expect(extractMentionHandles("@Alice")).toEqual(["alice"]);
  });
  it("ignores lone @ without a following letter", () => {
    expect(extractMentionHandles("email @ example.com")).toEqual([]);
  });
  it("supports handles with dots, underscores, hyphens", () => {
    expect(extractMentionHandles("@john_smith.jr-42")).toEqual(["john_smith.jr-42"]);
  });
});

describe("resolveHandles", () => {
  const members: OrgMember[] = [
    { id: "u1", name: "Alice", handle: "alice" },
    { id: "u2", name: "Bob Smith", handle: "bob_smith" },
    { id: "u3", name: "Carol", handle: "carol" },
  ];

  it("resolves known handles to user IDs", () => {
    expect(resolveHandles(["alice", "bob_smith"], members, "other")).toEqual([
      "u1",
      "u2",
    ]);
  });
  it("drops unresolved handles silently", () => {
    expect(resolveHandles(["unknown_person"], members, "other")).toEqual([]);
  });
  it("skips the author (no self-notification)", () => {
    expect(resolveHandles(["alice"], members, "u1")).toEqual([]);
  });
  it("returns empty array for no handles", () => {
    expect(resolveHandles([], members, "other")).toEqual([]);
  });
});
