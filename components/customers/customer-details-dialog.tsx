"use client";

import { Ban, Pencil } from "lucide-react";
import { CancelButton } from "@/components/customers/cancel-button";
import { CopyMacButton } from "@/components/customers/copy-mac-button";
import { CustomerTags, PlanValueInfo } from "@/components/customers/customer-value";
import { DeleteButton } from "@/components/customers/delete-button";
import { RenewButton } from "@/components/customers/renew-button";
import { StatusBadge } from "@/components/customers/status-badge";
import type { EnrichedCustomer } from "@/components/customers/types";
import { WhatsAppLink } from "@/components/customers/whatsapp-link";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InfoTip } from "@/components/ui/info-tip";
import { describeDays, formatDateBR, toAppDateISO } from "@/lib/date";
import { formatCurrency } from "@/lib/format";
import type { GlossaryKey } from "@/lib/glossary";
import type { UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";

const DAYS_TONE = {
  active: "text-muted-foreground",
  expiring: "text-warning",
  expired: "text-destructive",
  canceled: "text-muted-foreground",
} as const;

/** Ficha completa do cliente: todas as informações e ações que não cabem na linha da lista. */
export function CustomerDetailsDialog({
  customer,
  onOpenChange,
  onEdit,
  userRole,
}: {
  customer: EnrichedCustomer | null;
  onOpenChange: (open: boolean) => void;
  onEdit: (customer: EnrichedCustomer) => void;
  userRole: UserRole;
}) {
  const isAdmin = userRole === "admin";

  return (
    <Dialog open={customer !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {customer && (
          <>
            <DialogHeader>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <DialogTitle className="text-lg">{customer.name}</DialogTitle>
                <StatusBadge status={customer.status} days={customer.days} />
              </div>
              <DialogDescription asChild>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <CustomerTags customer={customer} userRole={userRole} />
                </div>
              </DialogDescription>
            </DialogHeader>

            <div className="-mx-1 overflow-y-auto px-1">
              <dl className="divide-y divide-border rounded-lg border border-border bg-background">
                <Row label="WhatsApp">
                  <WhatsAppLink customer={customer} />
                </Row>
                <Row label="MAC Address">
                  <CopyMacButton id={`details-mac-${customer.id}`} value={customer.mac_address} />
                </Row>
                <Row label="Aplicativo">{customer.app_name || <Muted>Não informado</Muted>}</Row>
                {isAdmin && (
                  <Row label="Painel" term="panel">
                    {customer.panel ? (
                      <span>
                        {customer.panel.name}{" "}
                        <Muted>· {formatCurrency(customer.panel.credit_cost)}/crédito</Muted>
                      </span>
                    ) : (
                      <span className="text-warning">Sem painel definido</span>
                    )}
                  </Row>
                )}
                <Row label={isAdmin ? "Valor líquido" : "Valor mensal"} term={isAdmin ? "netValue" : "resellerCommission"}>
                  <PlanValueInfo customer={customer} userRole={userRole} />
                </Row>
                <Row label="Vencimento">
                  <span className="text-right">
                    <span className="tabular-nums">{formatDateBR(customer.expires_at)}</span>
                    <span className={cn("block text-xs", DAYS_TONE[customer.status])}>{describeDays(customer.days)}</span>
                  </span>
                </Row>
                {isAdmin && customer.payment_date && (
                  <Row label="Data do pagamento" term="paymentDate">
                    <span className="tabular-nums">{formatDateBR(customer.payment_date)}</span>
                  </Row>
                )}
                {customer.canceled_at && (
                  <Row label="Cancelado em" term="cancelChurn">
                    <span className="inline-flex items-center gap-1.5 tabular-nums">
                      <Ban className="size-3.5 text-subtle-foreground" strokeWidth={1.75} aria-hidden="true" />
                      {formatDateBR(customer.canceled_at)}
                    </span>
                  </Row>
                )}
                <Row label="Cadastrado em">
                  <span className="tabular-nums">{formatDateBR(toAppDateISO(customer.created_at))}</span>
                </Row>
              </dl>

              {customer.notes && (
                <div className="mt-3 rounded-lg border border-border bg-background px-3.5 py-3">
                  <p className="text-xs text-subtle-foreground">Observações</p>
                  <p className="mt-1 text-sm break-words whitespace-pre-line text-muted-foreground">{customer.notes}</p>
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-1">
                <CancelButton customer={customer} full />
                <DeleteButton customer={customer} full />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  id={`details-edit-${customer.id}`}
                  variant="outline"
                  size="sm"
                  className="flex-1 sm:flex-none"
                  onClick={() => onEdit(customer)}
                >
                  <Pencil /> Editar
                </Button>
                <RenewButton customer={customer} className="flex-1 sm:flex-none" />
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, term, children }: { label: string; term?: GlossaryKey; children: React.ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 px-3.5 py-2 text-sm">
      <dt className="inline-flex shrink-0 items-center gap-1 text-muted-foreground">
        {label}
        {term && <InfoTip term={term} align="start" />}
      </dt>
      <dd className="min-w-0 text-right">{children}</dd>
    </div>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-subtle-foreground">{children}</span>;
}
