import Image from "next/image";

// "Option B" from the homepage prototype (real photo, raised opacity,
// bounded to one section) applied to every other sandbox page's header,
// per explicit request after reviewing the homepage hero options. Not a
// production component - deleting app/design-sandbox/ removes this too.
//
// 0.55 opacity / 35% scrim, same numbers as the homepage's Option B -
// versus production PageAtmosphere's 0.3 opacity / 50% scrim across the
// whole fixed page background. Bounded to just this header block (not
// `fixed inset-0` like PageAtmosphere) so it stays one deliberate moment
// per page, not something every section inherits.
export function PhotoHeader({
  src,
  focalPosition = "50% 30%",
  title,
  description,
}: {
  src: string;
  focalPosition?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-border p-6">
      <Image
        src={src}
        alt=""
        fill
        sizes="100vw"
        className="-z-20 object-cover opacity-55"
        style={{ objectPosition: focalPosition }}
      />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-bg-primary/35" />
      <h1 className="relative font-display text-heading-lg text-text-primary drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]">
        {title}
      </h1>
      {description && (
        <p className="relative mt-1 text-body-md text-text-secondary drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
          {description}
        </p>
      )}
    </div>
  );
}
