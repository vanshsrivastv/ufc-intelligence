"use client";

import { useState } from "react";
import type { PerformanceTagDto } from "@ufc-intelligence/types";

export function PerformanceProfile({ tags }: { tags: PerformanceTagDto[] }) {
  // "active" rather than "hovered" - mouseenter/mouseleave never fire on a
  // touch device at all, so hover-only left mobile with no way to ever see
  // a tag's explanation (tapping visibly did nothing). onClick sets the
  // same state as hover and toggles off on a repeat tap, so touch gets a
  // real tap-to-reveal/tap-to-dismiss interaction instead of relying on a
  // pointer event that will never come.
  const [active, setActive] = useState<PerformanceTagDto | null>(null);

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
          <button
            key={tag.id}
            type="button"
            onMouseEnter={() => setActive(tag)}
            onMouseLeave={() => setActive(null)}
            onClick={() => setActive((current) => (current?.id === tag.id ? null : tag))}
            className={`flex items-center rounded-full border px-3.5 py-1.5 transition-standard ${
              active?.id === tag.id ? "border-gold-500" : "border-border hover:border-gold-500"
            }`}
          >
            <span
              className={`text-xs transition-standard ${
                active?.id === tag.id ? "text-gold-300" : "text-text-primary hover:text-gold-300"
              }`}
            >
              {tag.label}
            </span>
          </button>
        ))}
      </div>

      <p className={`mt-3.5 min-h-[16px] text-xs ${active ? "text-gold-300" : "text-text-secondary"}`}>
        {active ? active.explain : "Tap or hover a tag to see what earned it."}
      </p>
    </div>
  );
}
