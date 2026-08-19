import Link from "next/link";
import { Heart } from "lucide-react";
import type { Session } from "next-auth";
import { auth, signOut } from "@/auth";
import { NavLinks } from "./nav-links";
import { MobileNavToggle } from "./mobile-nav-toggle";
import { UserAvatar } from "@/components/ui/user-avatar";

export async function Nav() {
  const session = await auth();

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-bg-primary/95 px-6 py-3 backdrop-blur-sm">
      <div className="relative mx-auto flex max-w-[1440px] items-center justify-between gap-6">
        <Link href="/" className="font-display text-[16px] font-medium text-text-primary">
          UFC Intelligence
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          <NavLinks />
          <AuthActions session={session} />
        </div>

        <MobileNavToggle>
          <NavLinks mobile />
          <div className="mt-3 flex flex-col gap-1 border-t border-border pt-3">
            <AuthActions session={session} mobile />
          </div>
        </MobileNavToggle>
      </div>
    </header>
  );
}

function AuthActions({
  session,
  mobile = false,
}: {
  session: Session | null;
  mobile?: boolean;
}) {
  if (session?.user) {
    const username = (session.user as any).username as string | undefined;
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
          <UserAvatar username={username ?? session.user.email ?? ""} className={mobile ? "h-6 w-6" : "h-5 w-5"} />
          {username ?? session.user.email}
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