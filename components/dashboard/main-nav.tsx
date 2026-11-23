"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppWindow, Users, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Clientes", icon: Users, id: "nav-customers", adminOnly: false },
  { href: "/finance", label: "Financeiro", icon: Wallet, id: "nav-finance", adminOnly: true },
  { href: "/apps", label: "Apps & TVs", icon: AppWindow, id: "nav-apps", adminOnly: false },
] as const;

/**
 * Navegação principal. O item "Financeiro" só é exibido para admins — isso é
 * apenas UX: a rota `/finance` e suas Server Actions validam o cargo no servidor.
 */
export function MainNav({ className, isAdmin }: { className?: string; isAdmin: boolean }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => isAdmin || !item.adminOnly);

  return (
    <nav aria-label="Navegação principal" className={className}>
      <ul className="flex items-center gap-1 rounded-lg bg-white/[0.04] p-1 sm:bg-transparent sm:p-0">
        {items.map(({ href, label, icon: Icon, id }) => {
          const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="min-w-0 flex-1 sm:flex-none">
              <Link
                id={id}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-8 items-center justify-center gap-2 rounded-md px-3 text-[13px] font-medium whitespace-nowrap transition-colors duration-150 sm:text-sm",
                  active
                    ? "bg-primary/20 text-foreground shadow-[inset_0_0_0_1px_rgb(91_132_232/0.35)]"
                    : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground",
                )}
              >
                <Icon className={cn("size-4 shrink-0", active && "text-primary-ink")} strokeWidth={1.75} aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
