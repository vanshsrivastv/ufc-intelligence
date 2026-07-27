import Link from "next/link";
import Image from "next/image";
import type { FighterSummaryDto } from "@ufc-intelligence/types";
import { FavoriteButton } from "./favorite-button";
import { FighterAvatar } from "./fighter-avatar";

export function FighterCard({
  fighter,
  initiallyFavorited = false,
}: {
  fighter: FighterSummaryDto;
  initiallyFavorited?: boolean;
}) {
  const record = `${fighter.record.wins}-${fighter.record.losses}-${fighter.record.draws}`;

  return (
    <Link
      href={`/fighters/${fighter.slug}`}
      className="group block rounded-lg border border-border bg-bg-elevated p-4 transition-standard hover:border-gold-500 hover:shadow-[0_0_0_1px_var(--color-gold-500),0_0_12px_rgba(201,160,80,0.15)]"
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
      <p className="mt-0.5 text-xs text-text-secondary">
        {record} {fighter.weightClass ? `· ${fighter.weightClass.name}` : ""}
      </p>

      {fighter.rank !== null && (
        <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
          <span className="text-[11px] text-text-secondary">Rank</span>
          <span className="text-[11px] font-medium text-gold-300">
            #{fighter.rank}
          </span>
        </div>
      )}
    </Link>
  );
}
