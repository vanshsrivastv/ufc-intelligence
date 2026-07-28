export default function DisclaimerPage() {
  return (
    <main className="mx-auto max-w-[760px] px-4 py-12 md:px-8">
      <h1 className="font-display text-heading-lg text-text-primary">
        Disclaimer
      </h1>
      <p className="mt-2 text-body-md text-text-secondary">
        Last updated: {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
      </p>

      <div className="mt-8 flex flex-col gap-6 text-body-md text-text-secondary">
        <Section title="Independent project">
          UFC Intelligence is an independent, unofficial project. It is not
          affiliated with, endorsed by, or sponsored by the Ultimate
          Fighting Championship (UFC) or Zuffa, LLC.
        </Section>
        <Section title="Predictions">
          Fight predictions on this site are generated from a statistical
          model built on historical fight data. They are estimates, not
          guarantees, and should not be relied on for betting or wagering
          decisions.
        </Section>
        <Section title="Data accuracy">
          Fighter records, statistics, and event details are sourced from
          public fight-history data and may not always be complete, current,
          or error-free.
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
