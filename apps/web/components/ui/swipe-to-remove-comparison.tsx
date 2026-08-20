"use client";

import { useState } from "react";
import { motion, useAnimation, type PanInfo } from "framer-motion";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "./toast-provider";

const REVEAL_WIDTH = 88;
const DELETE_THRESHOLD = -64;
const FLING_VELOCITY = -500;

// Swipe-left-to-remove for a saved comparison row: dragging reveals a red
// delete panel underneath, and either a fast/far-enough swipe or a tap on
// that panel removes it - replaces a permanently-visible X button with a
// gesture that only shows the destructive action once you've started
// asking for it.
export function SwipeToRemoveComparison({
  fighterAId,
  fighterBId,
  children,
}: {
  fighterAId: string;
  fighterBId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const controls = useAnimation();
  const [removing, setRemoving] = useState(false);

  async function remove() {
    if (removing) return;
    setRemoving(true);
    await controls.start({ x: "-100%", transition: { duration: 0.2, ease: "easeIn" } });

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
      await controls.start({ x: 0, transition: { duration: 0.2 } });
      setRemoving(false);
    }
  }

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x < DELETE_THRESHOLD || info.velocity.x < FLING_VELOCITY) {
      remove();
    } else {
      controls.start({ x: 0, transition: { type: "spring", stiffness: 500, damping: 40 } });
    }
  }

  return (
    <div className="relative overflow-hidden">
      <button
        type="button"
        onClick={remove}
        aria-label="Remove saved comparison"
        disabled={removing}
        className="absolute inset-y-0 right-0 flex w-[88px] items-center justify-center gap-1.5 bg-danger text-white"
      >
        <Trash2 size={16} strokeWidth={1.75} />
      </button>
      <motion.div
        drag={removing ? false : "x"}
        dragConstraints={{ left: -REVEAL_WIDTH, right: 0 }}
        dragElastic={0.05}
        dragMomentum={false}
        animate={controls}
        onDragEnd={handleDragEnd}
        // Note: framer-motion remaps onDragStart to its OWN gesture
        // callback, not the native HTML5 dragstart DOM event - it can't
        // be used here to block native drag. The actual fix is
        // draggable={false} on the Link/img children themselves (an <a
        // href> and an <img> are natively draggable by default in every
        // browser, which is what shows up as the OS "copy" ghost/cursor
        // fighting framer-motion's own pointer-based drag) plus
        // select-none so a mouse-drag can't start a text selection
        // instead of the swipe gesture.
        className="relative select-none bg-bg-elevated [-webkit-user-drag:none] [touch-action:pan-y]"
      >
        {children}
      </motion.div>
    </div>
  );
}
