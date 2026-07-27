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

  return (
    <div
      className={`flex h-full w-full items-center justify-center ${className}`}
      style={{ backgroundColor: toneFor(name) }}
    >
      <span className="font-display text-lg font-medium text-gold-100">
        {initials(name)}
      </span>
    </div>
  );
}