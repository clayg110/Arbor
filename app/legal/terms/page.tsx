import type { Metadata } from "next";
import { SITE, COMPANY, LEGAL_UPDATED } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `Terms of Service for ${SITE.name}.`,
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <article className="space-y-5 text-[14px] leading-relaxed text-ink">
      <header>
        <h1 className="text-[22px] font-medium">Terms of Service</h1>
        <p className="mt-1 text-[12px] text-subtle">Last updated: {LEGAL_UPDATED}</p>
      </header>

      <p className="text-muted">
        These Terms govern your access to and use of {SITE.name}, operated by{" "}
        {COMPANY.legalName} (&ldquo;we&rdquo;, &ldquo;us&rdquo;). By creating an account
        or using the service you agree to these Terms. This template is provided as a
        starting point and is not legal advice — have counsel review before launch.
      </p>

      <Section title="1. The service">
        {SITE.name} aggregates publicly available signals about companies moving through
        private-equity deal lifecycles and presents them as research intelligence. We do
        not provide investment advice; outputs are informational and may be incomplete or
        inaccurate.
      </Section>

      <Section title="2. Accounts">
        You are responsible for safeguarding your credentials and for all activity under
        your account. Organization administrators may invite, manage, and remove members,
        and control the organization&rsquo;s subscription.
      </Section>

      <Section title="3. Acceptable use">
        You agree not to misuse the service: no unlawful use, no attempts to breach
        security or access data you are not authorized to, no scraping beyond your
        plan&rsquo;s API limits, and no resale of data without written permission.
      </Section>

      <Section title="4. Subscriptions & billing">
        Paid plans are billed through our payment processor on a recurring basis until
        cancelled. Rate limits and features vary by plan. You can manage or cancel your
        subscription from the billing portal; access continues until the end of the paid
        period.
      </Section>

      <Section title="5. Data">
        Your handling of personal data is described in our{" "}
        <a className="underline" href="/legal/privacy">
          Privacy Policy
        </a>
        . You may export or delete your account data at any time from your settings.
      </Section>

      <Section title="6. Disclaimers & liability">
        The service is provided &ldquo;as is&rdquo; without warranties of any kind. To the
        maximum extent permitted by law, we are not liable for indirect or consequential
        damages, and our aggregate liability is limited to the fees you paid in the
        preceding twelve months.
      </Section>

      <Section title="7. Changes & contact">
        We may update these Terms; material changes will be notified in-app or by email.
        Questions: {COMPANY.contactEmail}.
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h2 className="text-[15px] font-medium">{title}</h2>
      <p className="text-muted">{children}</p>
    </section>
  );
}
