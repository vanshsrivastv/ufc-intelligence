import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-[1440px] flex-col items-center gap-3 px-4 py-24 text-center md:px-8">
      <Compass size={24} strokeWidth={1.5} className="text-text-muted" />
      <h1 className="font-display text-heading-lg text-text-primary">
        Page not found
      </h1>
      <p className="max-w-sm text-body-md text-text-secondary">
        The page you're looking for doesn't exist, or may have been moved.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-md border border-border-strong px-4 py-2 text-body-md text-text-primary transition-standard hover:border-gold-500 hover:text-gold-300"
      >
        Back to home
      </Link>
    </main>
  );
}
