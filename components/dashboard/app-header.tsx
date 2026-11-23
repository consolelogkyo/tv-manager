import { LogOut } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { Logo } from "@/components/brand/logo";
import { MainNav } from "@/components/dashboard/main-nav";
import { Button } from "@/components/ui/button";
import type { UserRole } from "@/lib/types";

export function AppHeader({ email, role }: { email: string; role: UserRole }) {
  return (
    <header className="sticky top-0 z-30 border-b border-header-border bg-header pt-[env(safe-area-inset-top)] backdrop-blur-md backdrop-saturate-150">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-8 gap-y-2 px-4 py-2 sm:h-14 sm:flex-nowrap sm:px-6 sm:py-0 lg:px-8">
        <div className="flex h-10 items-center sm:h-auto">
          <Logo />
        </div>

        <MainNav className="order-last w-full sm:order-none sm:w-auto" isAdmin={role === "admin"} />

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden max-w-[220px] truncate text-[13px] text-muted-foreground md:block">{email}</span>
          {/* Logout via Server Action (POST + verificação de Origin) — invalida a sessão no servidor. */}
          <form action={signOut}>
            <Button id="sign-out" type="submit" variant="ghost" size="sm" className="text-muted-foreground hover:bg-white/[0.06] hover:text-foreground">
              <LogOut />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
