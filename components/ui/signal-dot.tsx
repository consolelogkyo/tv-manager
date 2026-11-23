import { cn } from "@/lib/utils";

export type SignalTone = "active" | "expiring" | "expired" | "canceled" | "neutral";

const TONES: Record<SignalTone, string> = {
  active: "bg-success",
  expiring: "bg-warning",
  expired: "bg-destructive",
  canceled: "border border-subtle-foreground bg-transparent",
  neutral: "bg-subtle-foreground",
};

/**
 * Assinatura visual do sistema: o "ponto de sinal" da TV.
 * Verde = ativo · âmbar = vencendo · vermelho = vencido · vazado = cancelado.
 * `pulse` liga a onda de alerta — usada só onde exige ação (ex.: vencendo em 3 dias).
 */
export function SignalDot({ tone, pulse = false, className }: { tone: SignalTone; pulse?: boolean; className?: string }) {
  if (!pulse) {
    return <span aria-hidden="true" className={cn("inline-block size-2 shrink-0 rounded-full", TONES[tone], className)} />;
  }
  return (
    <span aria-hidden="true" className={cn("relative inline-flex size-2 shrink-0", className)}>
      <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-75", TONES[tone])} />
      <span className={cn("relative inline-flex size-2 rounded-full", TONES[tone])} />
    </span>
  );
}
