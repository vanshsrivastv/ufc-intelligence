"use client";

import { useEffect, useState } from "react";

function timeLeft(target: number) {
  const diff = Math.max(0, target - Date.now());
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff / 3_600_000) % 24),
    minutes: Math.floor((diff / 60_000) % 60),
    seconds: Math.floor((diff / 1000) % 60),
    done: diff <= 0,
  };
}

export function CountdownTimer({ targetDate }: { targetDate: string }) {
  const target = new Date(targetDate).getTime();
  // Starts null on both server and first client render - Date.now() is
  // never identical between the two, so computing a real value here
  // (rather than deferring to the effect below) mismatched on whichever
  // second boundary the two renders happened to straddle, and React
  // threw a hydration error on every single page load.
  const [remaining, setRemaining] = useState<ReturnType<typeof timeLeft> | null>(null);

  useEffect(() => {
    setRemaining(timeLeft(target));
    const interval = setInterval(() => setRemaining(timeLeft(target)), 1000);
    return () => clearInterval(interval);
  }, [target]);

  if (remaining === null || remaining.done) return null;

  return (
    <div className="flex gap-3">
      <TimeUnit value={remaining.days} label="Days" />
      <TimeUnit value={remaining.hours} label="Hrs" />
      <TimeUnit value={remaining.minutes} label="Min" />
      <TimeUnit value={remaining.seconds} label="Sec" />
    </div>
  );
}

function TimeUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center rounded-md border border-border bg-bg-elevated-2 px-3 py-2 tabular-nums">
      <span className="font-display text-xl font-medium text-gold-300">
        {String(value).padStart(2, "0")}
      </span>
      <span className="text-[10px] uppercase tracking-wide text-text-muted">{label}</span>
    </div>
  );
}
