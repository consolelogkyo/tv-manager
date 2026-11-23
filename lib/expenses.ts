import type { BillingEventType, ExpenseCategory } from "@/lib/types";

/** Rótulo e cor (ponto/segmento do gráfico) de cada categoria de despesa extra. */
export const EXPENSE_CATEGORY_META: Record<
  ExpenseCategory,
  { label: string; dot: string; bar: string }
> = {
  panel_migration: {
    label: "Troca de Painel",
    dot: "bg-violet-400",
    bar: "bg-violet-400/80",
  },
  whatsapp_chip: {
    label: "Chip / WhatsApp",
    dot: "bg-success",
    bar: "bg-success/80",
  },
  app_license: {
    label: "Licença de App",
    dot: "bg-sky-400",
    bar: "bg-sky-400/80",
  },
  marketing: {
    label: "Marketing",
    dot: "bg-pink-400",
    bar: "bg-pink-400/80",
  },
  infrastructure: {
    label: "Infraestrutura",
    dot: "bg-teal-400",
    bar: "bg-teal-400/80",
  },
  internal_use: {
    label: "Uso Interno",
    dot: "bg-warning",
    bar: "bg-warning/80",
  },
  other: {
    label: "Outros",
    dot: "bg-muted-foreground",
    bar: "bg-muted-foreground/70",
  },
};

export const BILLING_EVENT_TYPE_LABEL: Record<BillingEventType, string> = {
  new_subscription: "Assinatura nova",
  renewal: "Renovação",
};
