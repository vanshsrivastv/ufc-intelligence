"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

// useSearchParams needs a Suspense boundary in the App Router, or the
// build fails - this page is inherently dynamic anyway (there's nothing
// to statically prerender for a one-time reset link), so the fallback
// below is only ever visible for a moment on first load.
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    const res = await fetch("/api/password-reset/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword: password }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ message: "Something went wrong." }));
      setError(body.message);
      return;
    }

    setSuccess(true);
    setTimeout(() => router.push("/signin"), 2000);
  }

  if (!token) {
    return (
      <main className="mx-auto max-w-[360px] px-4 py-16">
        <h1 className="font-display text-heading-lg text-text-primary">Reset password</h1>
        <p className="mt-2 text-body-md text-text-secondary">
          This link is missing its reset token.{" "}
          <Link href="/forgot-password" className="text-gold-300 hover:underline">
            Request a new one
          </Link>
          .
        </p>
      </main>
    );
  }

  if (success) {
    return (
      <main className="mx-auto max-w-[360px] px-4 py-16">
        <h1 className="font-display text-heading-lg text-text-primary">Password reset</h1>
        <p className="mt-2 text-body-md text-text-secondary">
          Your password has been updated. Redirecting to sign in...
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[360px] px-4 py-16">
      <h1 className="font-display text-heading-lg text-text-primary">Reset password</h1>
      <p className="mt-2 text-body-md text-text-secondary">Choose a new password for your account.</p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <div>
          <label className="text-caption text-text-secondary">New password</label>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-bg-elevated px-3 py-2 text-body-md text-text-primary outline-none transition-standard focus:border-gold-500"
          />
        </div>
        <div>
          <label className="text-caption text-text-secondary">Confirm new password</label>
          <input
            type="password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-bg-elevated px-3 py-2 text-body-md text-text-primary outline-none transition-standard focus:border-gold-500"
          />
        </div>

        {error && <p className="text-xs text-danger">{error}</p>}

        <button
          type="submit"
          className="mt-2 rounded-md bg-gold-300 py-2.5 text-body-md font-medium text-text-on-gold transition-standard hover:bg-gold-100"
        >
          Reset password
        </button>
      </form>
    </main>
  );
}
