export default function TermsPage() {
  return (
    <main className="mx-auto max-w-[760px] px-4 py-12 md:px-8">
      <h1 className="font-display text-heading-lg text-text-primary">
        Terms of Service
      </h1>
      <p className="mt-2 text-body-md text-text-secondary">
        Last updated: {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
      </p>

      <div className="mt-8 flex flex-col gap-6 text-body-md text-text-secondary">
        <Section title="Use of this site">
          UFC Intelligence is an independent analytics and reference project.
          You may browse, search, and use the fighter, event, ranking, and
          prediction data for personal, non-commercial purposes.
        </Section>
        <Section title="Accounts">
          You&apos;re responsible for keeping your account credentials
          secure. We reserve the right to suspend accounts used to abuse or
          disrupt the service.
        </Section>
        <Section title="No guarantee of accuracy">
          Fighter records, statistics, and predictions are provided for
          informational purposes only and may contain errors or omissions.
          See the Disclaimer for details.
        </Section>
        <Section title="Changes">
          These terms may be updated from time to time. Continued use of the
          site after a change constitutes acceptance of the updated terms.
        </Section>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-display text-heading-md text-text-primary">{title}</h2>
      <p className="mt-2">{children}</p>
    </div>
  );
}
