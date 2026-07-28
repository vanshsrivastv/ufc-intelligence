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
      <div className="mx-auto grid max-w-[1440px] gap-8 px-4 py-10 sm:grid-cols-2 md:px-8 lg:grid-cols-4">
        <div>
          <p className="font-display text-heading-md text-text-primary">
            UFC Intelligence
          </p>
          <p className="mt-2 max-w-xs text-body-md text-text-secondary">
            Career-deep fighter stats, real event history, and explainable
            fight predictions.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <a
              href="mailto:contact@ufc-intelligence.dev"
              aria-label="Email us"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-text-secondary transition-standard hover:border-gold-500 hover:text-gold-300"
            >
              <Mail size={15} strokeWidth={1.75} />
            </a>
            <a
              href="https://github.com/"
              target="_blank"
              rel="noreferrer noopener"
              aria-label="GitHub repository"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-text-secondary transition-standard hover:border-gold-500 hover:text-gold-300"
            >
              <Github size={15} strokeWidth={1.75} />
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
          <p className="mt-3 text-body-md text-text-secondary">
            Fighter and fight-history data sourced from{" "}
            <span className="text-text-primary">UFC Stats</span>.
          </p>
          <p className="mt-2 text-body-md text-text-secondary">
            Built with Next.js, NestJS, and Prisma.
          </p>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-text-muted sm:flex-row md:px-8">
          <p>&copy; {year} UFC Intelligence. All rights reserved.</p>
          <p>v{packageJson.version}</p>
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
      <ul className="mt-3 flex flex-col gap-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-body-md text-text-secondary transition-standard hover:text-gold-300"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
