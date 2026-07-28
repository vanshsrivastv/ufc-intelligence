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
        className="object-cover opacity-20 blur-[1px]"
        style={{ objectPosition: focalPosition }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 50% 0%, transparent 0%, var(--color-bg-primary) 78%)",
        }}
      />
      <div className="absolute inset-0 bg-bg-primary/60" />
    </div>
  );
}
