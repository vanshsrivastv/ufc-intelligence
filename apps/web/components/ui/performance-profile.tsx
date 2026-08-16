"use client";

import { useState } from "react";
import type { PerformanceTagDto } from "@ufc-intelligence/types";

export function PerformanceProfile({ tags }: { tags: PerformanceTagDto[] }) {
  const [hovered, setHovered] = useState<PerformanceTagDto | null>(null);

  // Empty on purpose whenever the fighter has too few completed fights or
  // no stat clears a threshold - same "say nothing rather than fabricate"
  // rule as every other stat display on this page, so the section is
  // simply omitted by the caller rather than rendering a bare heading.
  if (tags.length === 0) return null;

  return (
    <div className="mt-6">
      <p className="font-display text-heading-md text-text-primary">Performance profile</p>

      <div className="mt-3 flex flex-wrap gap-2">
        {tags.map((tag) => (
          <div
            key={tag.id}
            onMouseEnter={() => setHovered(tag)}
            onMouseLeave={() => setHovered(null)}
            className="flex items-center rounded-full border border-border px-3.5 py-1.5 transition-standard hover:border-gold-500"
          >
            <span className="text-xs text-text-primary transition-standard hover:text-gold-300">
              {tag.label}
            </span>
          </div>
        ))}
      </div>

      <p className={`mt-3.5 min-h-[16px] text-xs ${hovered ? "text-gold-300" : "text-text-secondary"}`}>
        {hovered ? hovered.explain : "Hover a tag to see what earned it."}
      </p>
    </div>
  );
}
