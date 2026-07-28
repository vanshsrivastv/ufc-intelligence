export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-[760px] px-4 py-12 md:px-8">
      <h1 className="font-display text-heading-lg text-text-primary">
        Privacy Policy
      </h1>
      <p className="mt-2 text-body-md text-text-secondary">
        Last updated: {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
      </p>

      <div className="mt-8 flex flex-col gap-6 text-body-md text-text-secondary">
        <Section title="What we collect">
          If you create an account, we store your email address and a
          securely hashed password. If you favorite fighters, we store which
          fighters you&apos;ve favorited against your account. We do not
          collect payment information, location data, or third-party
          tracking data.
        </Section>
        <Section title="How we use it">
          Account data is used only to provide the favorites and
          personalization features on this site. We do not sell or share
          your data with third parties.
        </Section>
        <Section title="Cookies">
          This site uses a session cookie to keep you signed in. No
          advertising or cross-site tracking cookies are used.
        </Section>
        <Section title="Contact">
          Questions about this policy can be sent to{" "}
          <a href="mailto:srivastavavansh2007@gmail.com" className="text-gold-300 hover:text-gold-100">
            srivastavavansh2007@gmail.com
          </a>
          .
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
