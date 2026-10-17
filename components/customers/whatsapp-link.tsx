import { MessageCircle } from "lucide-react";
import { buildWhatsAppLink, formatPhone } from "@/lib/format";
import type { EnrichedCustomer } from "@/components/customers/types";

export function WhatsAppLink({ customer }: { customer: EnrichedCustomer }) {
  if (!customer.phone) {
    return <span className="text-xs text-muted-foreground/70">Sem WhatsApp</span>;
  }

  const href = buildWhatsAppLink({
    phone: customer.phone,
    name: customer.name,
    expiresAt: customer.expires_at,
    daysRemaining: customer.days,
    planValue: customer.plan_value,
  });

  const label = formatPhone(customer.phone);
  if (!href) return <span className="text-xs text-muted-foreground">{label}</span>;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title="Enviar lembrete pelo WhatsApp"
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-success"
    >
      <MessageCircle className="size-3.5" />
      {label}
    </a>
  );
}
