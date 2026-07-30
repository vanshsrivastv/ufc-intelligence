"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FighterSummaryDto } from "@ufc-intelligence/types";
import { FighterSearchInput } from "./fighter-search-input";

export function ComparePicker() {
  const router = useRouter();
  const [fighterA, setFighterA] = useState<FighterSummaryDto | null>(null);
  const [fighterB, setFighterB] = useState<FighterSummaryDto | null>(null);

  function pick(which: "a" | "b", fighter: FighterSummaryDto) {
    const nextA = which === "a" ? fighter : fighterA;
    const nextB = which === "b" ? fighter : fighterB;
    if (which === "a") setFighterA(fighter);
    else setFighterB(fighter);
    if (nextA && nextB) {
      router.push(`/compare?fighters=${nextA.slug},${nextB.slug}`);
    }
  }

  return (
    <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
      <FighterSearchInput label="Fighter A" onSelect={(f) => pick("a", f)} />
      <span className="hidden pb-2 text-center font-display italic text-text-muted sm:block">
        vs
      </span>
      <FighterSearchInput label="Fighter B" onSelect={(f) => pick("b", f)} />
    </div>
  );
}
