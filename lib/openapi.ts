// OpenAPI 3.1 description of the public API (/api/v1). Served at
// GET /api/v1/openapi and the contract for external consumers. Keep in sync with
// the route handlers when endpoints change.

import { SITE } from "@/lib/site";

export const openapiSpec = {
  openapi: "3.1.0",
  info: {
    title: "Arbor Public API",
    version: "1.0.0",
    description:
      "Read access to the Arbor company intelligence corpus. Authenticate with an " +
      "API key: `Authorization: Bearer arbor_...`. Rate limits and quotas scale " +
      "with your plan.",
  },
  servers: [{ url: `${SITE.url}/api/v1`, description: "Production" }],
  security: [{ bearerAuth: [] }],
  paths: {
    "/companies": {
      get: {
        summary: "List companies",
        description:
          "Returns companies ordered by most recently updated. Paginate with the " +
          "opaque `cursor` (keyset; preferred) or `offset`. Requires the `read` scope.",
        parameters: [
          { name: "sector", in: "query", schema: { type: "string" } },
          {
            name: "deal",
            in: "query",
            schema: { type: "string", enum: ["carveout", "private_asset"] },
          },
          {
            name: "stage",
            in: "query",
            schema: {
              type: "string",
              enum: ["in_market", "monitor_for_exit", "on_hold", "pulled"],
            },
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", minimum: 1, maximum: 500, default: 100 },
          },
          {
            name: "cursor",
            in: "query",
            description: "nextCursor from the previous page (keyset pagination).",
            schema: { type: "string" },
          },
          {
            name: "offset",
            in: "query",
            description: "Legacy offset pagination (prefer cursor).",
            schema: { type: "integer", minimum: 0 },
          },
        ],
        responses: {
          "200": {
            description: "A page of companies.",
            headers: {
              "x-request-id": {
                description: "Correlation id (quote in support requests).",
                schema: { type: "string" },
              },
            },
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CompanyPage" },
              },
            },
          },
          "401": {
            description: "Missing, invalid, or revoked API key.",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/Error" } },
            },
          },
          "403": {
            description: "Key lacks the required `read` scope.",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/Error" } },
            },
          },
          "429": {
            description: "Rate limit exceeded. See the `Retry-After` header.",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/Error" } },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "arbor_<key>" },
    },
    schemas: {
      Company: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          sector: { type: "string" },
          dealType: { type: "string", enum: ["carveout", "private_asset"] },
          stage: {
            type: "string",
            enum: ["in_market", "monitor_for_exit", "on_hold", "pulled"],
          },
          confidence: {
            type: "string",
            enum: ["high", "medium", "low", "needs_review"],
          },
          sponsorFirm: { type: ["string", "null"] },
          parentCompany: { type: ["string", "null"] },
          revenue: { type: ["string", "null"] },
          ebitda: { type: ["string", "null"] },
          updatedAt: { type: "string", format: "date-time" },
        },
        required: ["id", "name", "sector", "dealType", "stage", "confidence"],
      },
      CompanyPage: {
        type: "object",
        properties: {
          companies: { type: "array", items: { $ref: "#/components/schemas/Company" } },
          total: { type: "integer" },
          limit: { type: "integer" },
          nextCursor: {
            type: ["string", "null"],
            description:
              "Pass as `cursor` to fetch the next page; null on the last page.",
          },
        },
        required: ["companies", "total", "limit", "nextCursor"],
      },
      Error: {
        type: "object",
        properties: { error: { type: "string" } },
        required: ["error"],
      },
    },
  },
} as const;
