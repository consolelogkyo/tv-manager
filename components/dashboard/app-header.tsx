import { LogOut, Tv } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

function initials(email: string) {
  return email.slice(0, 2).toUpperCase();
}

export function AppHeader({ email }: { email: string }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent-violet shadow-lg shadow-primary/30 ring-1 ring-white/15">
            <Tv className="size-[18px] text-white" strokeWidth={2.2} />
          </div>
          <div className="leading-tight">
            <p className="font-display text-base font-semibold tracking-tight">TV Manager</p>
            <p className="hidden text-xs text-muted-foreground sm:block">Gestão de assinaturas</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden items-center gap-2 rounded-full border border-border/70 bg-card/60 py-1 pr-3 pl-1 sm:flex">
            <span className="grid size-7 place-items-center rounded-full bg-primary/20 text-[11px] font-bold text-primary">
              {initials(email)}
            </span>
            <span className="max-w-[180px] truncate text-xs text-muted-foreground">{email}</span>
          </div>
          {/* Logout via Server Action (POST + verificação de Origin) — invalida a sessão no servidor. */}
          <form action={signOut}>
            <Button id="sign-out" type="submit" variant="ghost" size="sm" className="text-muted-foreground">
              <LogOut />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
