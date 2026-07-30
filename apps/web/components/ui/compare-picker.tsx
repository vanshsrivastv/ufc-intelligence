"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FighterSummaryDto } from "@ufc-intelligence/types";
import { FighterSearchInput } from "./fighter-search-input";
import { FighterAvatar } from "./fighter-avatar";

function genderOf(fighter: FighterSummaryDto): "men" | "women" | undefined {
  return fighter.weightClass ? (fighter.weightClass.isWomens ? "women" : "men") : undefined;
}

export function ComparePicker({ lockedA }: { lockedA?: FighterSummaryDto }) {
  const router = useRouter();
  const [fighterA, setFighterA] = useState<FighterSummaryDto | null>(lockedA ?? null);
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
      {lockedA ? (
        <div>
          <p className="text-caption text-text-secondary">Fighter A</p>
          <div className="mt-1 flex items-center gap-2 rounded-md border border-border bg-bg-elevated px-3 py-2">
            <div className="h-6 w-6 overflow-hidden rounded-full">
              <FighterAvatar name={lockedA.name} photoUrl={lockedA.photoUrl} />
            </div>
            <span className="text-body-md text-text-primary">{lockedA.name}</span>
          </div>
        </div>
      ) : (
        <FighterSearchInput
          label="Fighter A"
          onSelect={(f) => pick("a", f)}
          genderFilter={fighterB ? genderOf(fighterB) : undefined}
        />
      )}
      <span className="hidden pb-2 text-center font-display italic text-text-muted sm:block">
        vs
      </span>
      <FighterSearchInput
        label="Fighter B"
        onSelect={(f) => pick("b", f)}
        genderFilter={fighterA ? genderOf(fighterA) : undefined}
      />
    </div>
  );
}
