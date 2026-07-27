import Link from "next/link";
import { Home, Users, Calendar, Trophy, Sparkles, Heart, BarChart3 } from "lucide-react";
import { auth, signOut } from "@/auth";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/fighters", label: "Fighters", icon: Users },
  { href: "/events", label: "Events", icon: Calendar },
  { href: "/rankings", label: "Rankings", icon: Trophy },
  { href: "/predictions", label: "Predictions", icon: Sparkles },
  { href: "/statistics", label: "Statistics", icon: BarChart3 },
];

export async function Nav() {
  const session = await auth();

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-bg-primary/95 px-6 py-3 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-6">
        <Link href="/" className="font-display text-[16px] font-medium text-text-primary">
          UFC Intelligence
        </Link>

        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs text-text-secondary transition-standard hover:bg-bg-elevated hover:text-gold-300"
            >
              <Icon size={14} strokeWidth={1.75} />
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {session?.user ? (
            <>
              <Link
                href="/favorites"
                className="flex items-center gap-1.5 text-xs text-text-secondary transition-standard hover:text-gold-300"
              >
                <Heart size={14} strokeWidth={1.75} />
                Favorites
              </Link>
              <form
                action={async () => {
                  "use server";
                  await signOut();
                }}
              >
                <button
                  type="submit"
                  className="rounded-full bg-bg-elevated px-3 py-1.5 text-xs text-text-secondary transition-standard hover:text-gold-300"
                >
                  {session.user.email}
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/signin"
              className="rounded-md bg-gold-300 px-3 py-1.5 text-xs font-medium text-text-on-gold transition-standard hover:bg-gold-100"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}