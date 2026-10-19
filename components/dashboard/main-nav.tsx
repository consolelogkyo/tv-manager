"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppWindow, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Clientes", icon: Users, id: "nav-customers" },
  { href: "/apps", label: "Apps & TVs", icon: AppWindow, id: "nav-apps" },
] as const;

export function MainNav({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegação principal" className={className}>
      <ul className="flex items-center gap-1 rounded-xl border border-border/70 bg-card/60 p-1 backdrop-blur">
        {NAV_ITEMS.map(({ href, label, icon: Icon, id }) => {
          const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex-1 sm:flex-none">
              <Link
                id={id}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-8 items-center justify-center gap-2 rounded-lg px-3.5 text-sm font-medium transition-all duration-200",
                  active
                    ? "bg-gradient-to-r from-primary/25 to-accent-violet/20 text-foreground shadow-sm shadow-primary/20 ring-1 ring-primary/40"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className={cn("size-4", active ? "text-primary" : "")} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
