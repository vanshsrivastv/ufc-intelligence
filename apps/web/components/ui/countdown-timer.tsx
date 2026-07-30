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
  const [remaining, setRemaining] = useState(() => timeLeft(target));

  useEffect(() => {
    const interval = setInterval(() => setRemaining(timeLeft(target)), 1000);
    return () => clearInterval(interval);
  }, [target]);

  if (remaining.done) return null;

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
