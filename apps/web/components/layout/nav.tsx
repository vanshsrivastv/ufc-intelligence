import Link from "next/link";
import { Heart } from "lucide-react";
import { prisma } from "@ufc-intelligence/database";
import { auth, signOut } from "@/auth";
import { NavLinks } from "./nav-links";
import { MobileNavToggle } from "./mobile-nav-toggle";
import { UserAvatar } from "@/components/ui/user-avatar";

interface NavProfile {
  username: string;
  displayName: string | null;
}

export async function Nav() {
  const session = await auth();

  // Deliberately NOT read from the session/JWT here - session.user.id is
  // stable (never changes without a fresh sign-in) and used as the
  // lookup key, but username/displayName are read live from the DB on
  // every render instead. The JWT strategy's session.update() mechanism
  // turned out to be unreliable in practice for keeping those two
  // fields fresh in-session (see git history for the investigation) -
  // a live DB read on every nav render sidesteps that class of bug
  // entirely rather than continuing to chase it. This is one small,
  // cheap indexed query per page load, not a real cost at this scale.
  const userId = (session?.user as any)?.id as string | undefined;
  const profile: NavProfile | null = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: { username: true, displayName: true },
      })
    : null;

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-bg-primary/95 px-6 py-3 backdrop-blur-sm">
      <div className="relative mx-auto flex max-w-[1440px] items-center justify-between gap-6">
        <Link href="/" className="font-display text-[16px] font-medium text-text-primary">
          UFC Intelligence
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          <NavLinks />
          <AuthActions signedIn={!!session?.user} profile={profile} />
        </div>

        <MobileNavToggle>
          <NavLinks mobile />
          <div className="mt-3 flex flex-col gap-1 border-t border-border pt-3">
            <AuthActions signedIn={!!session?.user} profile={profile} mobile />
          </div>
        </MobileNavToggle>
      </div>
    </header>
  );
}

function AuthActions({
  signedIn,
  profile,
  mobile = false,
}: {
  signedIn: boolean;
  profile: NavProfile | null;
  mobile?: boolean;
}) {
  if (signedIn && profile) {
    // Twitter-style: a friendlier display name shown up front when set,
    // with the stable username as the fallback - the whole reason
    // displayName exists as a separate field from username at all
    // (previously collected on signup/account settings but never
    // actually rendered anywhere).
    const shownName = profile.displayName || profile.username;
    return (
      <div className={mobile ? "flex flex-col gap-1" : "flex items-center gap-3"}>
        <Link
          href="/favorites"
          className={
            mobile
              ? "flex items-center gap-2 rounded-md px-3 py-2.5 text-sm text-text-secondary transition-standard hover:bg-bg-elevated hover:text-gold-300"
              : "flex items-center gap-1.5 text-xs text-text-secondary transition-standard hover:text-gold-300"
          }
        >
          <Heart size={mobile ? 16 : 14} strokeWidth={1.75} />
          Favorites
        </Link>
        <Link
          href="/account"
          className={
            mobile
              ? "flex items-center gap-2 rounded-md px-3 py-2.5 text-sm text-text-secondary transition-standard hover:bg-bg-elevated hover:text-gold-300"
              : "flex items-center gap-1.5 rounded-full bg-bg-elevated py-1 pl-1 pr-3 text-xs text-text-secondary transition-standard hover:text-gold-300"
          }
        >
          <UserAvatar username={profile.username} className={mobile ? "h-6 w-6" : "h-5 w-5"} />
          {shownName}
        </Link>
        <form
          action={async () => {
            "use server";
            await signOut();
          }}
        >
          <button
            type="submit"
            className={
              mobile
                ? "flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm text-text-secondary transition-standard hover:bg-bg-elevated hover:text-gold-300"
                : "text-xs text-text-secondary transition-standard hover:text-gold-300"
            }
          >
            Sign out
          </button>
        </form>
      </div>
    );
  }

  return (
    <Link
      href="/signin"
      className={
        mobile
          ? "rounded-md bg-gold-300 px-3 py-2.5 text-center text-sm font-medium text-text-on-gold transition-standard hover:bg-gold-100"
          : "rounded-md bg-gold-300 px-3 py-1.5 text-xs font-medium text-text-on-gold transition-standard hover:bg-gold-100"
      }
    >
      Sign in
    </Link>
  );
}