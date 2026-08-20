import Link from "next/link";
import Image from "next/image";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import type { FighterSummaryDto } from "@ufc-intelligence/types";
import { FavoriteButton } from "./favorite-button";
import { FighterAvatar } from "./fighter-avatar";

export function FighterCard({
  fighter,
  initiallyFavorited = false,
  variant = "default",
  eloTrend,
  footer,
}: {
  fighter: FighterSummaryDto;
  initiallyFavorited?: boolean;
  // "portrait" is the 2026-08-18 visual-audit treatment (portrait photo
  // instead of a wide 3:1 crop, flat surface instead of glass, plain-text
  // record/rank instead of stacked badges) - opt-in only, used by the
  // Fighters list page. Defaults to the original card so every other
  // caller (Favorites) is completely unaffected.
  variant?: "default" | "portrait";
  // Portrait-only, opt-in (My Roster passes these; Fighters list doesn't).
  // A trend arrow next to Elo needs a second data point (recent
  // EloHistory) the caller already has to fetch anyway to decide whether
  // it's meaningful to show at all (e.g. hidden for inactive fighters) -
  // simpler for the card to just render what it's given than to fetch
  // history itself.
  eloTrend?: "up" | "down" | "flat";
  // Portrait-only. A second link (e.g. "Next: vs X") can't nest inside
  // the card's own <Link>, so when provided the whole card gets wrapped
  // in a plain outer <div> instead of returning the <Link> as the root -
  // callers that don't pass a footer are completely unaffected.
  footer?: React.ReactNode;
}) {
  const record = `${fighter.record.wins}-${fighter.record.losses}-${fighter.record.draws}`;

  if (variant === "portrait") {
    // When a footer is present, the outer wrapper owns the border/rounded
    // corners/hover state instead - otherwise the inner Link's own border
    // would double up with the wrapper's, showing as a visible seam right
    // above the footer.
    const card = (
      <Link
        href={`/fighters/${fighter.slug}`}
        draggable={false}
        className={
          footer
            ? "group block overflow-hidden bg-bg-elevated"
            : "group block overflow-hidden rounded-lg border border-border bg-bg-elevated transition-standard hover:border-border-strong"
        }
      >
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-bg-elevated-2">
          <FighterAvatar name={fighter.name} photoUrl={fighter.photoUrl} />
          <div className="absolute right-1 top-1 rounded-full bg-bg-primary/60 backdrop-blur-sm">
            <FavoriteButton fighterId={fighter.id} initiallyFavorited={initiallyFavorited} />
          </div>
        </div>
        <div className="p-3">
          <p className="truncate font-display text-[14px] font-medium text-text-primary">
            {fighter.name}
          </p>
          <p className="mt-0.5 truncate text-xs text-text-secondary">
            {record}
            {fighter.weightClass ? ` · ${fighter.weightClass.name}` : ""}
          </p>
          <div className="mt-1.5 flex items-center justify-between text-xs">
            {fighter.elo !== null ? (
              <span className="flex items-center gap-1 font-medium tabular-nums text-text-primary">
                Elo {Math.round(fighter.elo)}
                {eloTrend === "up" && <ArrowUp size={12} className="text-success" />}
                {eloTrend === "down" && <ArrowDown size={12} className="text-danger" />}
                {eloTrend === "flat" && <Minus size={12} className="text-text-muted" />}
              </span>
            ) : (
              <span />
            )}
            {fighter.rank !== null && (
              <span className="font-medium text-gold-300">
                {fighter.rank === 0 ? "Champion" : `#${fighter.rank}`}
              </span>
            )}
          </div>
        </div>
      </Link>
    );

    if (!footer) return card;

    return (
      <div className="overflow-hidden rounded-lg border border-border bg-bg-elevated transition-standard hover:border-border-strong">
        {card}
        {footer}
      </div>
    );
  }

  return (
    <Link
      href={`/fighters/${fighter.slug}`}
      className="group block rounded-lg border border-glass bg-glass p-4 backdrop-blur-2xl backdrop-saturate-150 shadow-glass transition-standard hover:-translate-y-0.5 hover:border-gold-500 hover:shadow-[0_0_0_1px_var(--color-gold-500),0_0_12px_rgba(201,160,80,0.15)]"
    >
      <div className="mb-3 h-24 w-full overflow-hidden rounded-md bg-bg-elevated-2">
        <FighterAvatar name={fighter.name} photoUrl={fighter.photoUrl} />
      </div>

      <div className="flex items-center justify-between">
        <p className="font-display text-[15px] font-medium text-text-primary">
          {fighter.name}
        </p>
        <FavoriteButton fighterId={fighter.id} initiallyFavorited={initiallyFavorited} />
      </div>
      {fighter.nickname && (
        <p className="mt-0.5 truncate text-xs italic text-text-muted">
          &ldquo;{fighter.nickname}&rdquo;
        </p>
      )}
      <div className="mt-0.5 flex items-baseline justify-between gap-2">
        <p className="truncate text-xs text-text-secondary">
          {record} {fighter.weightClass ? `· ${fighter.weightClass.name}` : ""}
        </p>
        {/* Omitted entirely when null (insufficient fight history) rather
            than showing a placeholder - a dash here would sit right next
            to a real record and could read as "we don't know," when the
            truth is closer to "there's nothing to compute this from." */}
        {fighter.elo !== null && (
          <p className="shrink-0 text-xs font-medium tabular-nums text-text-primary">
            Elo {Math.round(fighter.elo)}
          </p>
        )}
      </div>

      {fighter.rank !== null && (
        <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
          <span className="text-[11px] text-text-secondary">
            {fighter.rank === 0 ? "" : "Rank"}
          </span>
          {fighter.rank === 0 ? (
            <span className="rounded-sm bg-gold-900 px-2 py-0.5 text-[10px] font-medium text-gold-300">
              Champion
            </span>
          ) : (
            <span className="text-[11px] font-medium text-gold-300">#{fighter.rank}</span>
          )}
        </div>
      )}
    </Link>
  );
}
