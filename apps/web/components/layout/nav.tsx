import Link from "next/link";
import { auth, signOut } from "@/auth";

export async function Nav() {
  const session = await auth();

  return (
    <header className="flex items-center justify-between border-b border-border px-6 py-4">
      <Link href="/" className="font-display text-[16px] font-medium text-text-primary">
        UFC Intelligence
      </Link>
      <nav className="flex items-center gap-6">
        <Link href="/fighters" className="text-xs text-text-secondary transition-standard hover:text-gold-300">
          Fighters
        </Link>
        <Link href="/events" className="text-xs text-text-secondary transition-standard hover:text-gold-300">
          Events
        </Link>
        <Link href="/rankings" className="text-xs text-text-secondary transition-standard hover:text-gold-300">
          Rankings
        </Link>

        {session?.user && (
          <Link href="/favorites" className="text-xs text-text-secondary transition-standard hover:text-gold-300">
            Favorites
          </Link>
        )}

        {session?.user ? (
          <form
            action={async () => {
              "use server";
              await signOut();
            }}
          >
            <button type="submit" className="text-xs text-text-secondary transition-standard hover:text-gold-300">
              Sign out ({session.user.email})
            </button>
          </form>
        ) : (
          <Link href="/signin" className="text-xs text-gold-300 hover:underline">
            Sign in
          </Link>
        )}
      </nav>
    </header>
  );
}