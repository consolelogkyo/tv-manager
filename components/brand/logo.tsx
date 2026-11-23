import { cn } from "@/lib/utils";

/**
 * Marca do TV Manager: uma tela com barras crescentes (a TV + a gestão do
 * negócio), em azul cobalto sólido. Usada no header, no login e como favicon
 * (`app/icon.svg` usa o mesmo desenho).
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" aria-hidden="true" className={cn("size-7 shrink-0", className)}>
      <rect width="28" height="28" rx="7" fill="var(--primary)" />
      <rect x="5.5" y="6.5" width="17" height="12" rx="2.5" fill="none" stroke="#fff" strokeWidth="1.6" />
      <path d="M11 22h6" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
      <rect x="9" y="13" width="2" height="3" rx="0.6" fill="#fff" fillOpacity="0.55" />
      <rect x="13" y="11" width="2" height="5" rx="0.6" fill="#fff" fillOpacity="0.8" />
      <rect x="17" y="9" width="2" height="7" rx="0.6" fill="#fff" />
    </svg>
  );
}

/** Marca + nome. `tagline` mostra a linha "Assinaturas & financeiro" abaixo do nome. */
export function Logo({ tagline = false, className }: { tagline?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="flex flex-col leading-none">
        <span className="text-[15px] tracking-[0.01em]">
          <span className="font-semibold text-foreground">TV</span>
          <span className="font-normal text-muted-foreground"> Manager</span>
        </span>
        {tagline && <span className="mt-1 text-[11px] text-subtle-foreground">Assinaturas &amp; financeiro</span>}
      </span>
    </span>
  );
}
