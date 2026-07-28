import Image from "next/image";

// A fixed, full-bleed background photo behind a page's content — low
// opacity, gradient-faded top and bottom, and slightly blurred so it reads
// as atmosphere rather than a competing image. Content above it should use
// the glass/glass-strong tokens (bg-glass + backdrop-blur) so the photo is
// actually visible through panels rather than hidden behind opaque cards.
export function PageAtmosphere({
  src,
  alt,
  focalPosition = "50% 30%",
}: {
  src: string;
  alt: string;
  focalPosition?: string;
}) {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <Image
        src={src}
        alt={alt}
        fill
        sizes="100vw"
        priority
        className="object-cover opacity-30"
        style={{ objectPosition: focalPosition }}
      />
      {/* Flat scrim, uniform top to bottom — keeps text contrast consistent
          wherever the viewport happens to be scrolled to, instead of only
          protecting the very top of the page. */}
      <div className="absolute inset-0 bg-bg-primary/50" />
      {/* Edge fade only at the very top (nav) and bottom, so the photo stays
          visible through the entire middle of the viewport at every scroll
          position rather than collapsing to solid a few hundred px down. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, var(--color-bg-primary) 0%, transparent 16%, transparent 84%, var(--color-bg-primary) 100%)",
        }}
      />
    </div>
  );
}
