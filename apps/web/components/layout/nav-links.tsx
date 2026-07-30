"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, Calendar, Trophy, Sparkles, BarChart3, GitCompare } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/fighters", label: "Fighters", icon: Users },
  { href: "/events", label: "Events", icon: Calendar },
  { href: "/rankings", label: "Rankings", icon: Trophy },
  { href: "/compare", label: "Compare", icon: GitCompare },
  { href: "/predictions", label: "Predictions", icon: Sparkles },
  { href: "/statistics", label: "Statistics", icon: BarChart3 },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();

  return (
    <nav className={mobile ? "flex flex-col gap-1" : "flex items-center gap-1"}>
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={
              mobile
                ? `flex items-center gap-2 rounded-md px-3 py-2.5 text-sm transition-standard ${
                    active
                      ? "bg-bg-elevated text-gold-300"
                      : "text-text-secondary hover:bg-bg-elevated hover:text-gold-300"
                  }`
                : `flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-standard ${
                    active
                      ? "bg-bg-elevated text-gold-300"
                      : "text-text-secondary hover:bg-bg-elevated hover:text-gold-300"
                  }`
            }
          >
            <Icon size={mobile ? 16 : 14} strokeWidth={1.75} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
