"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { UserAvatar } from "@/components/ui/user-avatar";

interface AccountInfo {
  email: string;
  username: string;
  displayName: string | null;
}

export default function AccountPage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.push("/signin");
  }, [status, router]);

  if (status !== "authenticated") {
    return (
      <main className="mx-auto max-w-[480px] px-4 py-16">
        <p className="text-body-md text-text-muted">Loading...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[480px] px-4 py-16">
      <h1 className="font-display text-heading-lg text-text-primary">Account</h1>
      <ProfileSection />
      <PasswordSection />
    </main>
  );
}

function ProfileSection() {
  const { update } = useSession();
  const [info, setInfo] = useState<AccountInfo | null>(null);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/account")
      .then((res) => res.json())
      .then((data: AccountInfo) => {
        setInfo(data);
        setUsername(data.username);
        setDisplayName(data.displayName ?? "");
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, displayName }),
    });

    setSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({ message: "Something went wrong." }));
      setError(body.message);
      return;
    }

    // JWT sessions don't re-read the DB on their own - update() re-signs
    // the JWT cookie (routes through the jwt callback's
    // trigger === "update" branch in auth.ts) so it carries the new
    // username. router.refresh() alone turned out not to reliably
    // re-render Nav (a Server Component in the root layout) afterward -
    // a full reload sidesteps that entirely: it's a real new navigation,
    // so Nav re-renders from the now-current cookie with no ambiguity
    // about RSC cache timing. Heavier than a soft refresh, but this is a
    // "save settings" action, not a hot path.
    await update();
    window.location.reload();
    return;
  }

  if (!info) {
    return <p className="mt-6 text-body-md text-text-muted">Loading...</p>;
  }

  return (
    <div className="mt-8 rounded-lg border border-border bg-bg-elevated p-6">
      <div className="flex items-center gap-3">
        <UserAvatar username={username || info.username} className="h-12 w-12" />
        <div>
          <p className="text-body-md font-medium text-text-primary">{info.email}</p>
          <p className="text-xs text-text-secondary">
            Member since your account was created
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <div>
          <label className="text-caption text-text-secondary">Username</label>
          <input
            type="text"
            required
            minLength={3}
            maxLength={20}
            pattern="[a-zA-Z][a-zA-Z0-9_]{2,19}"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-bg-elevated-2 px-3 py-2 text-body-md text-text-primary outline-none transition-standard focus:border-gold-500"
          />
        </div>
        <div>
          <label className="text-caption text-text-secondary">Display name (optional)</label>
          <input
            type="text"
            maxLength={60}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-bg-elevated-2 px-3 py-2 text-body-md text-text-primary outline-none transition-standard focus:border-gold-500"
          />
        </div>

        {error && <p className="text-xs text-danger">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="mt-2 self-start rounded-md bg-gold-300 px-5 py-2 text-body-md font-medium text-text-on-gold transition-standard hover:bg-gold-100 disabled:opacity-40"
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
      </form>
    </div>
  );
}

function PasswordSection() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError("New passwords don't match.");
      return;
    }

    setSaving(true);
    const res = await fetch("/api/account/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    setSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({ message: "Something went wrong." }));
      setError(body.message);
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setSuccess(true);
  }

  return (
    <div className="mt-6 rounded-lg border border-border bg-bg-elevated p-6">
      <p className="font-display text-heading-md text-text-primary">Change password</p>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        <div>
          <label className="text-caption text-text-secondary">Current password</label>
          <input
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-bg-elevated-2 px-3 py-2 text-body-md text-text-primary outline-none transition-standard focus:border-gold-500"
          />
        </div>
        <div>
          <label className="text-caption text-text-secondary">New password</label>
          <input
            type="password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-bg-elevated-2 px-3 py-2 text-body-md text-text-primary outline-none transition-standard focus:border-gold-500"
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
            className="mt-1 w-full rounded-md border border-border bg-bg-elevated-2 px-3 py-2 text-body-md text-text-primary outline-none transition-standard focus:border-gold-500"
          />
        </div>

        {error && <p className="text-xs text-danger">{error}</p>}
        {success && <p className="text-xs text-success">Password changed.</p>}

        <button
          type="submit"
          disabled={saving}
          className="mt-2 self-start rounded-md border border-border px-5 py-2 text-body-md font-medium text-text-primary transition-standard hover:border-gold-500 hover:text-gold-300 disabled:opacity-40"
        >
          {saving ? "Saving..." : "Change password"}
        </button>
      </form>
    </div>
  );
}
