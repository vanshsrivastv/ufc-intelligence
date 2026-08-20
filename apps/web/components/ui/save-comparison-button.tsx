"use client";

import { useState } from "react";
import { Bookmark } from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useToast } from "./toast-provider";

export function SaveComparisonButton({
  fighterAId,
  fighterBId,
  initiallySaved = false,
}: {
  fighterAId: string;
  fighterBId: string;
  initiallySaved?: boolean;
}) {
  const { data: session } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const [saved, setSaved] = useState(initiallySaved);
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (!session?.user) {
      router.push("/signin");
      return;
    }

    const next = !saved;
    setPending(true);
    setSaved(next);

    try {
      const res = await fetch("/api/saved-comparisons", {
        method: next ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fighterAId, fighterBId }),
      });
      if (!res.ok) throw new Error("Request failed");
      toast(next ? "Comparison saved to your roster" : "Comparison removed", "success");
    } catch {
      setSaved(!next);
      toast("Couldn't update saved comparisons — try again.", "error");
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs transition-standard disabled:opacity-50 ${
        saved
          ? "border-gold-500 bg-gold-900/30 text-gold-300"
          : "border-border bg-bg-elevated text-text-secondary hover:text-gold-300"
      }`}
    >
      <Bookmark size={14} strokeWidth={1.75} fill={saved ? "currentColor" : "none"} />
      {saved ? "Saved to My Roster" : "Save this comparison"}
    </button>
  );
}
