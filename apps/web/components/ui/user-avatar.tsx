// A deterministic initials avatar for user accounts - same reasoning as
// FighterAvatar's fallback (fighter-avatar.tsx): no file-upload infra
// exists anywhere in this codebase, and building one just for profile
// pictures would be real new infrastructure for a feature that doesn't
// need it. Deterministic per-username so the same user always gets the
// same look, same gold-on-dark tone family as the rest of the app.
function initials(name: string): string {
  const parts = name.trim().split(/[\s_]+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : parts[0]?.[1] ?? "";
  return (first + last).toUpperCase();
}

function toneFor(name: string): string {
  const tones = ["var(--color-gold-700)", "var(--color-text-secondary)", "var(--color-gold-900)"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % tones.length;
  return tones[hash];
}

export function UserAvatar({ username, className = "" }: { username: string; className?: string }) {
  const tone = toneFor(username);
  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-bg-elevated-2 ${className}`}
    >
      <div
        className="absolute inset-0"
        style={{ background: `radial-gradient(circle at 50% 40%, ${tone}33, transparent 70%)` }}
      />
      <span className="relative font-display text-sm font-medium text-gold-100">
        {initials(username)}
      </span>
    </div>
  );
}
