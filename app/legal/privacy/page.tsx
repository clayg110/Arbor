import type { Metadata } from "next";
import { SITE, COMPANY, LEGAL_UPDATED } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `Privacy Policy for ${SITE.name}.`,
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <article className="space-y-5 text-[14px] leading-relaxed text-ink">
      <header>
        <h1 className="text-[22px] font-medium">Privacy Policy</h1>
        <p className="mt-1 text-[12px] text-subtle">Last updated: {LEGAL_UPDATED}</p>
      </header>

      <p className="text-muted">
        This policy explains what {COMPANY.legalName} collects when you use {SITE.name},
        how we use it, and the rights you have. Template only — not legal advice.
      </p>

      <Section title="Data we collect">
        <ul className="ml-4 list-disc space-y-1">
          <li>
            <strong>Account data</strong> — email, name, role, and organization
            membership.
          </li>
          <li>
            <strong>Usage data</strong> — analyst notes, watchlists, and audit events you
            generate.
          </li>
          <li>
            <strong>Operational data</strong> — server logs and error reports used to keep
            the service running and secure.
          </li>
        </ul>
      </Section>

      <Section title="How we use it">
        To provide and secure the service, authenticate you, scope data to your
        organization, process billing, and improve reliability. The company research
        corpus is built from publicly available sources and is not personal data about
        you.
      </Section>

      <Section title="Cookies">
        We use only essential, first-party cookies required for authentication and session
        management. We do not use advertising or cross-site tracking cookies.
      </Section>

      <Section title="Sub-processors">
        We share data with infrastructure providers strictly to operate the service:
        hosting/database (Supabase), error monitoring (Sentry), email delivery (Resend),
        and payments (Stripe). Each processes data only on our instructions.
      </Section>

      <Section title="Your rights (GDPR / CCPA)">
        You can access and export your data at any time, and delete your account, from{" "}
        <a className="underline" href="/settings">
          Settings
        </a>
        . Deletion removes your profile, notes, and watchlist. To exercise any other
        right, contact {COMPANY.contactEmail}.
      </Section>

      <Section title="Retention">
        We retain account data while your account is active. On deletion, personal data is
        removed promptly; minimal records may be kept where required for legal or
        accounting obligations.
      </Section>

      <Section title="Contact">Privacy questions: {COMPANY.contactEmail}.</Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h2 className="text-[15px] font-medium">{title}</h2>
      <div className="text-muted">{children}</div>
    </section>
  );
}
