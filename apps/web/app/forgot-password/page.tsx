"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const res = await fetch("/api/password-reset/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ message: "Something went wrong." }));
      setError(body.message);
      return;
    }

    setSubmitted(true);
  }

  return (
    <main className="mx-auto max-w-[360px] px-4 py-16">
      <h1 className="font-display text-heading-lg text-text-primary">Forgot password</h1>
      <p className="mt-2 text-body-md text-text-secondary">
        Enter your account email and we'll create a reset link.
      </p>

      {submitted ? (
        <div className="mt-6 rounded-md border border-border bg-bg-elevated p-4">
          <p className="text-body-md text-text-primary">
            If an account exists for that email, a reset link has been sent.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <div>
            <label className="text-caption text-text-secondary">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-bg-elevated px-3 py-2 text-body-md text-text-primary outline-none transition-standard focus:border-gold-500"
            />
          </div>

          {error && <p className="text-xs text-danger">{error}</p>}

          <button
            type="submit"
            className="mt-2 rounded-md bg-gold-300 py-2.5 text-body-md font-medium text-text-on-gold transition-standard hover:bg-gold-100"
          >
            Send reset link
          </button>
        </form>
      )}

      <p className="mt-4 text-center text-xs text-text-muted">
        <Link href="/signin" className="text-gold-300 hover:underline">
          Back to sign in
        </Link>
      </p>
    </main>
  );
}
