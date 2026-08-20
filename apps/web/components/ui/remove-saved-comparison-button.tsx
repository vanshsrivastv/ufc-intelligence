"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "./toast-provider";

export function RemoveSavedComparisonButton({
  fighterAId,
  fighterBId,
}: {
  fighterAId: string;
  fighterBId: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setPending(true);
    try {
      const res = await fetch("/api/saved-comparisons", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fighterAId, fighterBId }),
      });
      if (!res.ok) throw new Error("Request failed");
      toast("Comparison removed", "success");
      router.refresh();
    } catch {
      toast("Couldn't remove — try again.", "error");
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-label="Remove saved comparison"
      className="rounded-md p-1.5 text-text-muted transition-standard hover:bg-bg-elevated-2 hover:text-danger disabled:opacity-50"
    >
      <X size={14} strokeWidth={1.75} />
    </button>
  );
}
