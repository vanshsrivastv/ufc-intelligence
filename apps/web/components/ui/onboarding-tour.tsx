"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "onboarding-tour-v1";

interface TourStep {
  id: string;
  title: string;
  desc: string;
}

const STEPS: TourStep[] = [
  {
    id: "fighters",
    title: "Fighters",
    desc: "Explore the full fighter roster, stats, Elo ratings, and performance profiles.",
  },
  {
    id: "events",
    title: "Events",
    desc: "Browse upcoming and past UFC events with full fight cards and results.",
  },
  {
    id: "rankings",
    title: "Rankings",
    desc: "Explore official rankings, Elo rankings, and statistical leaderboards.",
  },
  {
    id: "compare",
    title: "Compare",
    desc: "Compare two fighters across multiple statistics and the radar chart.",
  },
  {
    id: "predictions",
    title: "Predictions",
    desc: "Get model-based win probabilities and prediction factors.",
  },
  {
    id: "statistics",
    title: "Statistics",
    desc: "See league-wide leaderboards, method-of-victory breakdowns, and Elo distribution.",
  },
];

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function OnboardingTour() {
  // -2 = still checking localStorage (also what both the server and the
  // very first client render use - keeping them identical avoids a
  // hydration mismatch the same way countdown-timer.tsx's fix did).
  // -1 = welcome card. 0..STEPS.length-1 = a real step.
  // STEPS.length = finished/skipped, never show again this session.
  const [step, setStep] = useState<number>(-2);
  const [isDesktop, setIsDesktop] = useState(false);
  const [rect, setRect] = useState<TargetRect | null>(null);

  useEffect(() => {
    setStep(localStorage.getItem(STORAGE_KEY) ? STEPS.length : -1);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    setIsDesktop(mq.matches);
    const onChange = () => setIsDesktop(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Positions the spotlight ring against the real nav link for the
  // current step. Desktop only - see the render branch below for why
  // mobile doesn't try to target the collapsed hamburger menu. The nav
  // is sticky (top-0), so its viewport position doesn't change on
  // scroll - only a resize (or a step change) needs a re-measure.
  useEffect(() => {
    if (!isDesktop || step < 0 || step >= STEPS.length) {
      setRect(null);
      return;
    }
    function measure() {
      const el = document.querySelector<HTMLElement>(`[data-tour="${STEPS[step].id}"]`);
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [step, isDesktop]);

  useEffect(() => {
    if (step < -1) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") finish();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function finish() {
    localStorage.setItem(STORAGE_KEY, "1");
    setStep(STEPS.length);
  }

  if (step === -2 || step >= STEPS.length) return null;

  if (step === -1) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
        <div className="w-full max-w-sm rounded-lg border border-border bg-bg-elevated p-6 text-center shadow-glass">
          <p className="font-display text-heading-md text-text-primary">Welcome to UFC Intelligence</p>
          <p className="mt-2 text-body-md text-text-secondary">
            Take a 30-second tour of what&apos;s here, or skip straight in.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <button
              type="button"
              onClick={finish}
              className="rounded-md border border-border px-4 py-2 text-xs text-text-secondary transition-standard hover:border-gold-500 hover:text-gold-300"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={() => setStep(0)}
              className="rounded-md bg-gold-300 px-4 py-2 text-xs font-medium text-text-on-gold transition-standard hover:bg-gold-100"
            >
              Start tour
            </button>
          </div>
        </div>
      </div>
    );
  }

  const current = STEPS[step];
  const goNext = () => (step === STEPS.length - 1 ? finish() : setStep((s) => s + 1));
  const goBack = () => setStep((s) => s - 1);

  // Mobile: the nav collapses into a hamburger menu that isn't open by
  // default, so there's no visible link to spotlight without forcing
  // the menu open out from under the user. Falls back to the same step
  // content as a plain bottom-anchored card instead of faking a target -
  // still a real, working tour, just without the spotlight-on-nav-item
  // part that only makes sense once the nav itself is on screen.
  if (!isDesktop || !rect) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
        <TourCard step={step} current={current} onBack={goBack} onNext={goNext} onSkip={finish} />
      </div>
    );
  }

  const pad = 6;
  const ringStyle: React.CSSProperties = {
    position: "fixed",
    top: rect.top - pad,
    left: rect.left - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
    borderRadius: 8,
    boxShadow: "0 0 0 3px #E8C572, 0 0 0 9999px rgba(0,0,0,0.72)",
    zIndex: 50,
    pointerEvents: "none",
    transition: "all 0.2s ease",
  };

  const coachStyle: React.CSSProperties = {
    position: "fixed",
    top: rect.top + rect.height + 12,
    left: Math.max(12, Math.min(rect.left, window.innerWidth - 272)),
    zIndex: 51,
  };

  return (
    <>
      <div style={ringStyle} />
      <div style={coachStyle}>
        <TourCard step={step} current={current} onBack={goBack} onNext={goNext} onSkip={finish} compact />
      </div>
    </>
  );
}

function TourCard({
  step,
  current,
  onBack,
  onNext,
  onSkip,
  compact = false,
}: {
  step: number;
  current: TourStep;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border border-gold-500 bg-bg-elevated p-4 shadow-glass ${
        compact ? "w-60" : "w-full max-w-sm"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-text-muted">
          {step + 1} / {STEPS.length}
        </span>
        <button
          type="button"
          onClick={onSkip}
          className="text-[11px] text-text-muted transition-standard hover:text-text-secondary"
        >
          Skip
        </button>
      </div>
      <p className="mt-1.5 text-body-md font-medium text-text-primary">{current.title}</p>
      <p className="mt-1 text-caption text-text-secondary">{current.desc}</p>
      <div className="mt-3 flex justify-end gap-2">
        {step > 0 && (
          <button
            type="button"
            onClick={onBack}
            className="rounded-md border border-border px-3 py-1.5 text-[11px] text-text-secondary transition-standard hover:border-gold-500 hover:text-gold-300"
          >
            Back
          </button>
        )}
        <button
          type="button"
          onClick={onNext}
          className="rounded-md bg-gold-300 px-3 py-1.5 text-[11px] font-medium text-text-on-gold transition-standard hover:bg-gold-100"
        >
          {step === STEPS.length - 1 ? "Done" : "Next"}
        </button>
      </div>
    </div>
  );
}
