"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex max-w-[1440px] flex-col items-center gap-3 px-4 py-24 text-center md:px-8">
      <AlertTriangle size={24} strokeWidth={1.5} className="text-danger" />
      <h1 className="font-display text-heading-lg text-text-primary">
        Something went wrong
      </h1>
      <p className="max-w-sm text-body-md text-text-secondary">
        This page hit an unexpected error. Try again, or head back to the
        homepage.
      </p>
      <button
        onClick={reset}
        className="mt-2 rounded-md border border-border-strong px-4 py-2 text-body-md text-text-primary transition-standard hover:border-gold-500 hover:text-gold-300"
      >
        Try again
      </button>
    </main>
  );
}
