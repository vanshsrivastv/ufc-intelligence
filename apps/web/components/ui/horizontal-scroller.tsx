"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Wraps a horizontally-scrolling strip (champions, trending fighters,
// ...) with prev/next buttons instead of leaving the browser's native
// scrollbar as the only visible affordance - that scrollbar renders as
// a raw OS-default track next to this app's glass/gold styling
// everywhere else. Scroll is still fully usable by drag/trackpad/wheel;
// .no-scrollbar (globals.css) just hides the track, it doesn't disable
// scrolling.
export function HorizontalScroller({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  function updateArrows() {
    const el = ref.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }

  useEffect(() => {
    updateArrows();
    const el = ref.current;
    if (!el) return;
    // ResizeObserver too, not just the scroll listener - content that
    // starts short enough to need no scrolling at all (a handful of
    // champions on a wide monitor) still has to hide both arrows, and a
    // window resize is the only thing that would ever change that
    // without a "scroll" event firing.
    const resizeObserver = new ResizeObserver(updateArrows);
    resizeObserver.observe(el);
    return () => resizeObserver.disconnect();
  }, []);

  function scrollBy(direction: 1 | -1) {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: "instant" as ScrollBehavior });
  }

  return (
    <div className="relative">
      <div
        ref={ref}
        onScroll={updateArrows}
        className="no-scrollbar flex divide-x divide-border overflow-x-auto pb-2"
      >
        {children}
      </div>

      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scrollBy(-1)}
          aria-label="Scroll left"
          className="absolute left-0 top-1/2 z-10 -translate-y-1/2 -translate-x-1/2 flex h-9 w-9 items-center justify-center rounded-full border border-border-strong bg-bg-elevated-2 text-text-secondary shadow-lg transition-standard hover:border-gold-500 hover:text-gold-300"
        >
          <ChevronLeft size={18} strokeWidth={1.75} />
        </button>
      )}
      {canScrollRight && (
        <button
          type="button"
          onClick={() => scrollBy(1)}
          aria-label="Scroll right"
          className="absolute right-0 top-1/2 z-10 -translate-y-1/2 translate-x-1/2 flex h-9 w-9 items-center justify-center rounded-full border border-border-strong bg-bg-elevated-2 text-text-secondary shadow-lg transition-standard hover:border-gold-500 hover:text-gold-300"
        >
          <ChevronRight size={18} strokeWidth={1.75} />
        </button>
      )}
    </div>
  );
}
