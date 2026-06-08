import { describe, it, expect, afterEach, vi } from "vitest";
import { freeSeats, seatLimit, seatStatus, getSeatStatus } from "@/lib/seats";
import { makeClient } from "./helpers/sb";

afterEach(() => vi.unstubAllEnvs());

describe("freeSeats / seatLimit", () => {
  it("defaults free seats to 3 (env-tunable)", () => {
    expect(freeSeats()).toBe(3);
    vi.stubEnv("FREE_SEATS", "5");
    expect(freeSeats()).toBe(5);
  });
  it("uses the Stripe quantity for paid plans, free seats otherwise", () => {
    expect(seatLimit("pro", 5)).toBe(5);
    expect(seatLimit("enterprise", 10)).toBe(10);
    expect(seatLimit("pro", null)).toBeNull(); // unsynced → unlimited (fail-open)
    expect(seatLimit("free", null)).toBe(3);
    expect(seatLimit(undefined, 99)).toBe(3);
  });
});

describe("seatStatus", () => {
  it("is unlimited when limit is null", () => {
    expect(seatStatus(100, null)).toEqual({
      used: 100,
      limit: null,
      available: null,
      full: false,
    });
  });
  it("computes availability + fullness", () => {
    expect(seatStatus(2, 5)).toMatchObject({ available: 3, full: false });
    expect(seatStatus(5, 5)).toMatchObject({ available: 0, full: true });
    expect(seatStatus(6, 5)).toMatchObject({ available: 0, full: true });
  });
});

describe("getSeatStatus", () => {
  it("is unlimited for a single-tenant (no org)", async () => {
    expect(await getSeatStatus(makeClient() as never, null)).toMatchObject({
      full: false,
    });
  });

  it("counts org members against the plan limit", async () => {
    const members = [
      { app_metadata: { org_id: "o1" } },
      { app_metadata: { org_id: "o1" } },
      { app_metadata: { org_id: "o1" } },
      { app_metadata: { org_id: "other" } },
    ];
    const svc = makeClient({
      result: { data: { plan: "free", seats: null } },
      admin: { listUsers: async () => ({ data: { users: members }, error: null }) },
    });
    const s = await getSeatStatus(svc as never, "o1");
    expect(s).toMatchObject({ used: 3, limit: 3, full: true });
  });
});
