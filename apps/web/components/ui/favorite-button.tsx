"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useToast } from "./toast-provider";

export function FavoriteButton({
  fighterId,
  initiallyFavorited = false,
}: {
  fighterId: string;
  initiallyFavorited?: boolean;
}) {
  const { data: session } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const [favorited, setFavorited] = useState(initiallyFavorited);
  const [celebrating, setCelebrating] = useState(false);

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!session?.user) {
      router.push("/signin");
      return;
    }

    const next = !favorited;
    setFavorited(next);
    if (next) setCelebrating(true);

    try {
      const res = await fetch("/api/favorites", {
        method: next ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fighterId }),
      });
      if (res.status === 401) {
        setFavorited(!next);
        toast("Sign in to save favorites.", "error");
        router.push("/signin");
        return;
      }
      if (!res.ok) throw new Error("Request failed");
      toast(next ? "Added to favorites" : "Removed from favorites", "success");
      // The /favorites page is a server component fetched via the router
      // cache — without this, navigating there can show a stale snapshot
      // from before this toggle (e.g. if the nav link was prefetched
      // earlier in the session).
      router.refresh();
    } catch {
      // Roll back the optimistic update so the UI matches what the server
      // actually has.
      setFavorited(!next);
      toast("Couldn't update favorites — try again.", "error");
    }
  }

  const gold = "#E8C572";
  const muted = "#6E6C63";
  const dark = "#1A1408";
  const color = favorited ? gold : muted;

  // A true regular octagon, centered at (16, 9), so the medallion reads as
  // a sharp geometric shape rather than a rounded blob.
  const octagon = (cx: number, cy: number, r: number) => {
    const points = Array.from({ length: 8 }, (_, i) => {
      const angle = (Math.PI / 8) + (i * Math.PI) / 4; // rotated so flat edges sit top/bottom
      return `${(cx + r * Math.sin(angle)).toFixed(2)},${(cy - r * Math.cos(angle) * 0.75).toFixed(2)}`;
    });
    return points.join(" ");
  };

  return (
    <button
      onClick={handleClick}
      aria-label={
        session?.user
          ? favorited
            ? "Remove from favorites"
            : "Add to favorites"
          : "Sign in to save favorites"
      }
      title={session?.user ? undefined : "Sign in to save favorites"}
      className="relative flex h-8 w-10 items-center justify-center overflow-visible"
    >
      <AnimatePresence>
        {celebrating && (
          <>
            {[0, 1].map((i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0.6, scale: 0.5 }}
                animate={{ opacity: 0, scale: 2 }}
                transition={{ duration: 0.5, delay: i * 0.1, ease: "easeOut" }}
                onAnimationComplete={() => i === 1 && setCelebrating(false)}
                className="absolute h-6 w-6 rounded-full border border-gold-300"
              />
            ))}
          </>
        )}
      </AnimatePresence>

      <motion.svg
        viewBox="0 0 32 18"
        className="relative h-5 w-9"
        animate={celebrating ? { scale: [1, 1.2, 1] } : { scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        {/* Straps — flat dark bands with sharp corners, studs in a grid */}
        <path d="M0 6.5 L7 6.5 L7 11.5 L0 11.5 Z" fill="#141412" stroke={color} strokeWidth="0.7" />
        <path d="M25 6.5 L32 6.5 L32 11.5 L25 11.5 Z" fill="#141412" stroke={color} strokeWidth="0.7" />
        {[2, 4].map((x) =>
          [8, 10].map((y) => (
            <rect key={`l-${x}-${y}`} x={x} y={y} width="0.8" height="0.8" fill={color} />
          )),
        )}
        {[27, 29].map((x) =>
          [8, 10].map((y) => (
            <rect key={`r-${x}-${y}`} x={x} y={y} width="0.8" height="0.8" fill={color} />
          )),
        )}

        {/* Outer octagon plate */}
        <polygon
          points={octagon(16, 9, 8.5)}
          fill="#141412"
          stroke={color}
          strokeWidth="1"
          strokeLinejoin="miter"
        />
        {/* Middle bezel step */}
        <polygon
          points={octagon(16, 9, 6.3)}
          fill="none"
          stroke={color}
          strokeWidth="0.6"
          strokeLinejoin="miter"
        />
        {/* Inner face — fills gold when favorited */}
        <polygon
          points={octagon(16, 9, 4.2)}
          fill={favorited ? gold : "none"}
          stroke={color}
          strokeWidth="0.9"
          strokeLinejoin="miter"
        />
        {/* Small center accent line, like the belt's vertical seam */}
        <line x1="16" y1="5.5" x2="16" y2="12.5" stroke={favorited ? dark : color} strokeWidth="0.5" />

        {celebrating && (
          <motion.rect
            x="6"
            y="0"
            width="3"
            height="18"
            fill="#F5E6C8"
            opacity={0.8}
            initial={{ x: 6 }}
            animate={{ x: 24 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
          />
        )}
      </motion.svg>
    </button>
  );
}