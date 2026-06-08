import { NextResponse } from "next/server";
import { openapiSpec } from "@/lib/openapi";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// GET /api/v1/openapi — public machine-readable API contract (no auth).
export function GET() {
  return NextResponse.json(openapiSpec, {
    headers: { ...CORS, "Cache-Control": "public, max-age=3600" },
  });
}
