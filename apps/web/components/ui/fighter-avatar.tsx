import Image from "next/image";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

// Deterministic per-name so the same fighter always gets the same tone,
// rather than a random color that'd shift on every render. References the
// same tokens as tokens.css/ui-tokens rather than duplicating raw hex here.
function toneFor(name: string): string {
  const tones = [
    "var(--color-gold-700)",
    "var(--color-text-secondary)",
    "var(--color-gold-900)",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % tones.length;
  return tones[hash];
}

// A no-photo fallback is the common case (most of the roster will never
// have a real photo), so it's designed as a real state rather than a bare
// placeholder: a radial glow behind the initials plus a faint octagon
// outline, in the same gold-on-dark language as the rest of the app.
function FallbackAvatar({ name, className }: { name: string; className: string }) {
  const tone = toneFor(name);
  return (
    <div
      className={`relative flex h-full w-full items-center justify-center overflow-hidden bg-bg-elevated-2 ${className}`}
    >
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at 50% 40%, ${tone}33, transparent 70%)`,
        }}
      />
      <svg
        viewBox="0 0 100 100"
        className="absolute h-[85%] w-[85%] opacity-[0.14]"
        aria-hidden="true"
      >
        <polygon
          points="50,4 84,21 96,50 84,79 50,96 16,79 4,50 16,21"
          fill="none"
          stroke={tone}
          strokeWidth="1.5"
        />
      </svg>
      <span className="relative font-display text-lg font-medium text-gold-100">
        {initials(name)}
      </span>
    </div>
  );
}

export function FighterAvatar({
  name,
  photoUrl,
  className = "",
}: {
  name: string;
  photoUrl?: string | null;
  className?: string;
}) {
  if (photoUrl) {
    return (
      <Image
        src={photoUrl}
        alt={name}
        width={200}
        height={200}
        className={`h-full w-full object-cover ${className}`}
      />
    );
  }

  return <FallbackAvatar name={name} className={className} />;
}