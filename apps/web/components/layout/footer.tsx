import Link from "next/link";
import { Github, Mail } from "lucide-react";
import packageJson from "../../package.json";

const LEGAL_LINKS = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/disclaimer", label: "Disclaimer" },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-border bg-bg-elevated">
      <div className="mx-auto grid max-w-[1440px] gap-6 px-4 py-7 sm:grid-cols-2 md:px-8 lg:grid-cols-4">
        <div>
          <p className="font-display text-body-lg font-medium text-text-primary">
            UFC Intelligence
          </p>
          <p className="mt-1.5 max-w-xs text-caption text-text-secondary">
            Career-deep fighter stats, real event history, and explainable
            fight predictions.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <a
              href="mailto:srivastavavansh2007@gmail.com"
              aria-label="Email us"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-text-secondary transition-standard hover:border-gold-500 hover:text-gold-300"
            >
              <Mail size={13} strokeWidth={1.75} />
            </a>
            <a
              href="https://github.com/vanshsrivastv/ufc-intelligence"
              target="_blank"
              rel="noreferrer noopener"
              aria-label="GitHub repository"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-text-secondary transition-standard hover:border-gold-500 hover:text-gold-300"
            >
              <Github size={13} strokeWidth={1.75} />
            </a>
          </div>
        </div>

        <FooterColumn
          title="Explore"
          links={[
            { href: "/fighters", label: "Fighters" },
            { href: "/events", label: "Events" },
            { href: "/rankings", label: "Rankings" },
            { href: "/predictions", label: "Predictions" },
            { href: "/statistics", label: "Statistics" },
          ]}
        />

        <FooterColumn title="Legal" links={LEGAL_LINKS} />

        <div>
          <p className="text-caption font-medium uppercase tracking-wide text-text-secondary">
            Data &amp; Credits
          </p>
          <p className="mt-2 text-caption text-text-secondary">
            Fighter and fight-history data sourced from{" "}
            <span className="text-text-primary">UFC Stats</span>.
          </p>
          <p className="mt-1.5 text-caption text-text-secondary">
            Built with Next.js, NestJS, and Prisma.
          </p>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto max-w-[1440px] px-4 py-3 md:px-8">
          <p className="mx-auto max-w-3xl text-center text-[11px] leading-relaxed text-text-muted">
            UFC Intelligence is an independent, unofficial fan-made analytics project and is not
            affiliated with, endorsed by, or sponsored by UFC or Zuffa LLC. UFC and related
            trademarks belong to their respective owners.
          </p>
          <div className="mt-2 flex flex-col items-center justify-between gap-1 text-xs text-text-muted sm:flex-row">
            <p>&copy; {year} UFC Intelligence. All rights reserved.</p>
            <p>v{packageJson.version}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div>
      <p className="text-caption font-medium uppercase tracking-wide text-text-secondary">
        {title}
      </p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-caption text-text-secondary transition-standard hover:text-gold-300"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
