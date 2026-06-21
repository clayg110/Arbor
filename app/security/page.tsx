import type { Metadata } from "next";
import Link from "next/link";
import { SITE, COMPANY } from "@/lib/site";

export const metadata: Metadata = {
  title: "Security",
  description: `How ${SITE.name} protects your deal data: tenant isolation, encryption, authentication, auditing, and our compliance roadmap.`,
  robots: { index: true, follow: true },
};

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-bg">
      <header
        style={{ borderBottom: "0.5px solid var(--border)" }}
        className="bg-surface"
      >
        <div className="mx-auto flex h-14 max-w-[820px] items-center justify-between px-6">
          <Link href="/" className="text-[15px] font-medium tracking-tight text-ink">
            {SITE.name}
          </Link>
          <nav className="flex items-center gap-4 text-[13px] text-muted">
            <Link href="/legal/terms" className="hover:text-ink">
              Terms
            </Link>
            <Link href="/legal/privacy" className="hover:text-ink">
              Privacy
            </Link>
            <Link href="/status" className="hover:text-ink">
              Status
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[820px] px-6 py-12">
        <article className="space-y-6 text-[14px] leading-relaxed text-ink">
          <header className="space-y-2">
            <h1 className="text-[24px] font-medium">Security at {SITE.name}</h1>
            <p className="text-muted">
              {SITE.name} handles live deal intelligence — who is buying what, at what
              price, and when. We treat that data as confidential by default and build
              security into every layer of the platform. This page summarizes the controls
              in place today and where we are headed.
            </p>
          </header>

          <Section title="Tenant isolation">
            Every record is scoped to your organization. Access is enforced in the
            database with PostgreSQL Row-Level Security, not just in application code, and
            the organization id is carried in a signed session token. A query can only
            ever return rows belonging to the caller&apos;s organization — cross-tenant
            reads return nothing.
          </Section>

          <Section title="Authentication & access">
            <ul className="ml-4 list-disc space-y-1">
              <li>Email/password and single sign-on (SSO) via your identity provider.</li>
              <li>
                Optional two-factor authentication (TOTP), with step-up to a higher
                assurance level on sign-in.
              </li>
              <li>
                Automated user provisioning and de-provisioning through SCIM 2.0 for
                enterprise directories.
              </li>
              <li>
                Brute-force protection: failed-login lockout and bot mitigation on
                authentication endpoints.
              </li>
              <li>
                Role-based access (analyst / admin) with scoped, revocable API keys.
              </li>
            </ul>
          </Section>

          <Section title="Encryption">
            All traffic is encrypted in transit over TLS. Data at rest — including your
            database and backups — is encrypted by our infrastructure provider. Secrets
            and tokens are compared in constant time to resist timing attacks.
          </Section>

          <Section title="Application hardening">
            <ul className="ml-4 list-disc space-y-1">
              <li>
                A strict Content-Security-Policy with per-request nonces, plus
                Cross-Origin-Opener-Policy and related security headers.
              </li>
              <li>Server-side input validation on every write path.</li>
              <li>
                Dependency and code scanning in CI (Dependabot, CodeQL) and a
                high-severity advisory gate that blocks vulnerable releases.
              </li>
            </ul>
          </Section>

          <Section title="Monitoring & audit trail">
            Every privileged action is written to an append-only audit log that
            administrators can review and export. Application errors and performance are
            tracked with request-correlated, structured logs and error monitoring. Live
            service health is published on our{" "}
            <Link className="underline" href="/status">
              status page
            </Link>
            .
          </Section>

          <Section title="Reliability">
            The ingestion pipeline is idempotent and fault-tolerant — retries with
            backoff, a circuit breaker, and a dead-letter queue keep a single bad source
            from affecting the rest. The platform is load-tested and uses keyset
            pagination so it stays responsive as your tracked universe grows.
          </Section>

          <Section title="Your data rights">
            You can export or permanently delete your data at any time from{" "}
            <Link className="underline" href="/settings">
              Settings
            </Link>
            . We act as a processor for the data you put into {SITE.name}; how we handle
            it is detailed in our{" "}
            <Link className="underline" href="/legal/privacy">
              Privacy Policy
            </Link>
            .
          </Section>

          <Section title="Compliance roadmap">
            {SITE.name} is built to SOC 2 control objectives — encryption, access control,
            audit logging, change management, and monitoring are all in place. A formal
            SOC 2 Type II examination and independent penetration test are on our roadmap;
            enterprise customers can request our current security documentation and
            questionnaire responses.
          </Section>

          <Section title="Reporting a vulnerability">
            We welcome reports from security researchers. If you believe you have found a
            vulnerability, email {COMPANY.contactEmail} with the details and steps to
            reproduce. Please give us a reasonable window to remediate before any public
            disclosure.
          </Section>
        </article>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h2 className="text-[16px] font-medium">{title}</h2>
      <div className="text-muted">{children}</div>
    </section>
  );
}
