import type { Metadata } from "next";
import { openapiSpec } from "@/lib/openapi";
import { SITE, COMPANY } from "@/lib/site";

export const metadata: Metadata = { title: "API Reference" };

export default function DocsPage() {
  const spec = openapiSpec;
  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-[860px] px-6 py-12">
        {/* Header */}
        <div className="mb-10 border-b pb-8" style={{ borderColor: "var(--border)" }}>
          <p className="text-[11px] font-medium uppercase tracking-widest text-muted">
            {SITE.name}
          </p>
          <h1 className="mt-2 text-[28px] font-medium text-ink">{spec.info.title}</h1>
          <p className="mt-2 max-w-[540px] text-[14px] text-muted">
            {spec.info.description}
          </p>
          <div className="mt-4 flex items-center gap-3">
            <span
              className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
              style={{
                background: "#EBF4FF",
                color: "#0C447C",
                border: "0.5px solid #B5D4F5",
              }}
            >
              v{spec.info.version}
            </span>
            <a
              href="/api/v1/openapi"
              className="text-[12px] text-[#185FA5] hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              OpenAPI 3.1 JSON ↗
            </a>
          </div>
        </div>

        {/* Authentication */}
        <section className="mb-10">
          <h2 className="mb-3 text-[16px] font-medium text-ink">Authentication</h2>
          <p className="text-[13px] text-muted">
            All requests must carry an API key in the{" "}
            <code className="rounded bg-[var(--bg)] px-1 py-0.5 text-[12px] font-mono text-ink">
              Authorization
            </code>{" "}
            header:
          </p>
          <CodeBlock>
            {`curl ${spec.servers[0]?.url}/companies \\
  -H "Authorization: Bearer arbor_YOUR_KEY"`}
          </CodeBlock>
          <p className="mt-3 text-[13px] text-muted">
            Generate keys in{" "}
            <a href="/admin" className="underline text-[#185FA5]">
              Admin → API keys
            </a>
            . Keys require the <Mono>read</Mono> scope.
          </p>
        </section>

        {/* Base URL */}
        <section className="mb-10">
          <h2 className="mb-3 text-[16px] font-medium text-ink">Base URL</h2>
          <CodeBlock>{spec.servers[0]?.url ?? ""}</CodeBlock>
        </section>

        {/* Rate limits */}
        <section className="mb-10">
          <h2 className="mb-3 text-[16px] font-medium text-ink">Rate limits</h2>
          <p className="text-[13px] text-muted">
            Requests are throttled per API key. When the limit is exceeded the server
            returns <Mono>429 Too Many Requests</Mono> with a <Mono>Retry-After</Mono>{" "}
            header (seconds to wait). Quota resets on a rolling 60-second window.
          </p>
        </section>

        {/* Endpoints */}
        <section className="mb-10">
          <h2 className="mb-6 text-[16px] font-medium text-ink">Endpoints</h2>

          {Object.entries(spec.paths).map(([path, methods]) =>
            Object.entries(methods as Record<string, unknown>).map(([method, op]) => {
              const o = op as {
                summary: string;
                description?: string;
                parameters?: {
                  name: string;
                  in: string;
                  schema: { type: string };
                  description?: string;
                }[];
              };
              return (
                <div
                  key={`${method}-${path}`}
                  className="mb-8 rounded-xl p-5"
                  style={{
                    border: "0.5px solid var(--border)",
                    background: "var(--surface)",
                  }}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="mt-0.5 shrink-0 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
                      style={{ backgroundColor: "#185FA5" }}
                    >
                      {method.toUpperCase()}
                    </span>
                    <div>
                      <code className="text-[14px] font-mono font-medium text-ink">
                        {path}
                      </code>
                      <p className="mt-0.5 text-[13px] font-medium text-ink">
                        {o.summary}
                      </p>
                    </div>
                  </div>

                  {o.description && (
                    <p className="mt-3 text-[13px] text-muted">{o.description}</p>
                  )}

                  {o.parameters && o.parameters.length > 0 && (
                    <div className="mt-4">
                      <p className="mb-2 text-[11px] font-medium uppercase tracking-widest text-muted">
                        Query parameters
                      </p>
                      <table className="w-full text-[12px]">
                        <thead>
                          <tr className="text-left">
                            <th className="pb-1.5 font-medium text-muted">Name</th>
                            <th className="pb-1.5 font-medium text-muted">Type</th>
                            <th className="pb-1.5 font-medium text-muted">Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          {o.parameters.map((p) => (
                            <tr
                              key={p.name}
                              className="border-t"
                              style={{ borderColor: "var(--border)" }}
                            >
                              <td className="py-1.5 pr-4">
                                <code className="font-mono text-ink">{p.name}</code>
                              </td>
                              <td className="py-1.5 pr-4 text-muted">{p.schema.type}</td>
                              <td className="py-1.5 text-muted">
                                {p.description ?? "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="mt-4">
                    <p className="mb-1.5 text-[11px] font-medium uppercase tracking-widest text-muted">
                      Example
                    </p>
                    <CodeBlock>
                      {`curl ${spec.servers[0]?.url}${path}?limit=10 \\
  -H "Authorization: Bearer arbor_YOUR_KEY"`}
                    </CodeBlock>
                  </div>
                </div>
              );
            })
          )}
        </section>

        {/* Pagination */}
        <section className="mb-10">
          <h2 className="mb-3 text-[16px] font-medium text-ink">Pagination</h2>
          <p className="text-[13px] text-muted">
            List endpoints return a <Mono>nextCursor</Mono> field. Pass it as the{" "}
            <Mono>cursor</Mono> query parameter to fetch the next page. A{" "}
            <Mono>null</Mono> cursor means you have reached the last page. Offset
            pagination (<Mono>offset=</Mono>) is supported for legacy clients but cursor
            is preferred.
          </p>
        </section>

        {/* Errors */}
        <section className="mb-10">
          <h2 className="mb-3 text-[16px] font-medium text-ink">Error responses</h2>
          <p className="mb-3 text-[13px] text-muted">
            Errors return a JSON body with a single <Mono>error</Mono> string field.
          </p>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left">
                <th className="pb-2 font-medium text-muted">Status</th>
                <th className="pb-2 font-medium text-muted">Meaning</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
              {[
                ["400", "Validation error — check request body/params"],
                ["401", "Missing or invalid API key"],
                ["403", "Key lacks required scope"],
                ["404", "Resource not found"],
                ["429", "Rate limit exceeded — see Retry-After"],
                ["500", "Internal server error — transient, safe to retry"],
              ].map(([code, meaning]) => (
                <tr key={code}>
                  <td className="py-1.5 pr-4 font-mono text-ink">{code}</td>
                  <td className="py-1.5 text-muted">{meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <footer
          className="border-t pt-6 text-[11px] text-subtle"
          style={{ borderColor: "var(--border)" }}
        >
          {SITE.name} API v{spec.info.version} · Questions?{" "}
          <a href={`mailto:${COMPANY.contactEmail}`} className="underline text-[#185FA5]">
            {COMPANY.contactEmail}
          </a>
        </footer>
      </div>
    </div>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre
      className="mt-2 overflow-x-auto rounded-lg p-3 font-mono text-[12px] text-ink"
      style={{ background: "var(--bg)", border: "0.5px solid var(--border)" }}
    >
      <code>{children}</code>
    </pre>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-[var(--bg)] px-1 py-0.5 font-mono text-[12px] text-ink">
      {children}
    </code>
  );
}
