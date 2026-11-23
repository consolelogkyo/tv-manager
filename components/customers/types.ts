import type { CustomerStatus } from "@/lib/date";
import type { Customer, PanelCreditBatch, PanelOption } from "@/lib/types";

/** Status exibido: o de vencimento ou "cancelado" (churn), que tem prioridade. */
export type DisplayStatus = CustomerStatus | "canceled";

export type EnrichedCustomer = Customer & {
  days: number;
  /** Status calculado apenas pelo vencimento. */
  expiryStatus: CustomerStatus;
  status: DisplayStatus;
  /** Painel vinculado (somente visão admin). */
  panel: PanelOption | null;
  /** Lotes de crédito do painel vinculado (somente visão admin). */
  panelBatches: PanelCreditBatch[];
};

export type StatusFilter = "all" | DisplayStatus;
