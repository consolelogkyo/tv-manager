"use client";

import { Ban, ChevronRight, PanelRightOpen, Pencil, StickyNote } from "lucide-react";
import { CopyMacButton } from "@/components/customers/copy-mac-button";
import { CustomerTags, PaymentDateTag, PlanValueInfo } from "@/components/customers/customer-value";
import { RenewButton } from "@/components/customers/renew-button";
import type { DisplayStatus, EnrichedCustomer } from "@/components/customers/types";
import { WhatsAppLink } from "@/components/customers/whatsapp-link";
import { Button } from "@/components/ui/button";
import { LabelWithInfo } from "@/components/ui/info-tip";
import { SignalDot } from "@/components/ui/signal-dot";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { describeDays, formatDateBR } from "@/lib/date";
import type { UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  customers: EnrichedCustomer[];
  onEdit: (customer: EnrichedCustomer) => void;
  onOpenDetails: (customer: EnrichedCustomer) => void;
  userRole: UserRole;
};

/** Faixa colorida à esquerda de cada cliente: é o indicador de status da lista. */
const ROW_ACCENT: Record<DisplayStatus, string> = {
  active: "before:bg-success",
  expiring: "before:bg-warning",
  expired: "before:bg-destructive",
  canceled: "before:bg-subtle-foreground/50",
};

const STATUS_LABEL: Record<DisplayStatus, string> = {
  active: "Ativo",
  expiring: "Vencendo",
  expired: "Vencido",
  canceled: "Cancelado",
};

const DAYS_TONE: Record<DisplayStatus, string> = {
  active: "text-muted-foreground",
  expiring: "text-warning",
  expired: "text-destructive",
  canceled: "text-muted-foreground",
};

/** Ponto de status ao lado do nome — pisca quando o cliente vence nos próximos 3 dias. */
function StatusDot({ customer }: { customer: EnrichedCustomer }) {
  return (
    <span title={STATUS_LABEL[customer.status]} className="inline-flex">
      <SignalDot tone={customer.status} pulse={customer.status === "expiring"} />
      <span className="sr-only">Status: {STATUS_LABEL[customer.status]}</span>
    </span>
  );
}

function NameButton({ customer, onOpenDetails }: { customer: EnrichedCustomer; onOpenDetails: Props["onOpenDetails"] }) {
  return (
    <button
      type="button"
      id={`open-${customer.id}`}
      onClick={() => onOpenDetails(customer)}
      className="min-w-0 cursor-pointer truncate text-left font-medium underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      title="Ver detalhes do cliente"
    >
      {customer.name}
    </button>
  );
}

function ExpiryInfo({ customer, userRole }: { customer: EnrichedCustomer; userRole: UserRole }) {
  return (
    <div className="flex flex-col">
      <span className="tabular-nums">{formatDateBR(customer.expires_at)}</span>
      <span className={cn("text-xs", DAYS_TONE[customer.status])}>
        {customer.canceled_at ? (
          <span className="inline-flex items-center gap-1">
            <Ban className="size-3 shrink-0" aria-hidden="true" />
            Cancelado em {formatDateBR(customer.canceled_at)}
          </span>
        ) : (
          describeDays(customer.days)
        )}
      </span>
      <PaymentDateTag customer={customer} userRole={userRole} />
    </div>
  );
}

function RowActions({ customer, onEdit, onOpenDetails }: Pick<Props, "onEdit" | "onOpenDetails"> & { customer: EnrichedCustomer }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <RenewButton customer={customer} />
      <Button
        id={`edit-${customer.id}`}
        variant="ghost"
        size="icon-sm"
        onClick={() => onEdit(customer)}
        className="text-muted-foreground"
        aria-label={`Editar ${customer.name}`}
        title="Editar"
      >
        <Pencil />
      </Button>
      <Button
        id={`details-${customer.id}`}
        variant="ghost"
        size="icon-sm"
        onClick={() => onOpenDetails(customer)}
        className="text-muted-foreground"
        aria-label={`Ver detalhes de ${customer.name}`}
        title="Detalhes, cancelar ou excluir"
      >
        <PanelRightOpen />
      </Button>
    </div>
  );
}

/* --------------------------------------------------------------- Desktop --- */

function DesktopTable({ customers, onEdit, onOpenDetails, userRole }: Props) {
  return (
    <div className="hidden overflow-hidden rounded-xl border border-border bg-card md:block">
      <Table className="table-fixed">
        <colgroup>
          <col />
          <col className="w-[200px] lg:w-[220px]" />
          <col className="w-[130px]" />
          <col className="w-[130px]" />
          <col className="w-[190px]" />
        </colgroup>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>
              <LabelWithInfo term="statusColors" align="start">
                Cliente
              </LabelWithInfo>
            </TableHead>
            <TableHead>MAC / aplicativo</TableHead>
            <TableHead className="text-right">
              {userRole === "admin" ? (
                <LabelWithInfo term="netValue" align="end">
                  Valor líquido
                </LabelWithInfo>
              ) : (
                "Valor mensal"
              )}
            </TableHead>
            <TableHead>Vencimento</TableHead>
            <TableHead className="text-right">
              <span className="sr-only">Ações</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.map((customer) => (
            <TableRow key={customer.id} className={cn(customer.status === "canceled" && "opacity-75")}>
              <TableCell
                className={cn(
                  "relative whitespace-normal before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-r-full",
                  ROW_ACCENT[customer.status],
                )}
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="flex min-w-0 items-center gap-2">
                    <StatusDot customer={customer} />
                    <NameButton customer={customer} onOpenDetails={onOpenDetails} />
                    {customer.notes && (
                      <span title={customer.notes} className="shrink-0 text-subtle-foreground">
                        <StickyNote className="size-3.5" strokeWidth={1.75} />
                        <span className="sr-only">Possui observações</span>
                      </span>
                    )}
                  </span>
                  <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 pl-4">
                    <WhatsAppLink customer={customer} />
                    <CustomerTags customer={customer} userRole={userRole} />
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex min-w-0 flex-col items-start gap-1">
                  <CopyMacButton id={`copy-mac-${customer.id}`} value={customer.mac_address} />
                  <span className="max-w-full truncate text-xs text-muted-foreground" title={customer.app_name ?? undefined}>
                    {customer.app_name || "Sem app"}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <PlanValueInfo customer={customer} userRole={userRole} />
              </TableCell>
              <TableCell>
                <ExpiryInfo customer={customer} userRole={userRole} />
              </TableCell>
              <TableCell>
                <RowActions customer={customer} onEdit={onEdit} onOpenDetails={onOpenDetails} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/* ---------------------------------------------------------------- Mobile --- */

function MobileList({ customers, onEdit, onOpenDetails, userRole }: Props) {
  return (
    <ul className="grid gap-3 md:hidden">
      {customers.map((customer) => (
        <li
          key={customer.id}
          className={cn(
            "relative overflow-hidden rounded-xl border border-border bg-card p-4 pl-5",
            "before:absolute before:inset-y-0 before:left-0 before:w-1",
            ROW_ACCENT[customer.status],
            customer.status === "canceled" && "opacity-80",
          )}
        >
          <button
            type="button"
            id={`open-m-${customer.id}`}
            onClick={() => onOpenDetails(customer)}
            className="flex w-full cursor-pointer items-start justify-between gap-3 text-left"
          >
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <StatusDot customer={customer} />
                <span className="truncate font-medium">{customer.name}</span>
              </span>
              <span className={cn("mt-1 block pl-4 text-xs", DAYS_TONE[customer.status])}>
                {customer.canceled_at
                  ? `Cancelado em ${formatDateBR(customer.canceled_at)}`
                  : `${formatDateBR(customer.expires_at)} · ${describeDays(customer.days)}`}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1">
              <PlanValueInfo customer={customer} userRole={userRole} />
              <ChevronRight className="size-4 text-subtle-foreground" strokeWidth={1.75} aria-hidden="true" />
            </span>
          </button>

          <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
            <RenewButton customer={customer} className="h-10 flex-1 text-sm" />
            <CopyMacButton id={`copy-mac-m-${customer.id}`} value={customer.mac_address} className="h-10" />
            <Button
              id={`edit-m-${customer.id}`}
              variant="ghost"
              size="icon"
              onClick={() => onEdit(customer)}
              className="text-muted-foreground"
              aria-label={`Editar ${customer.name}`}
            >
              <Pencil />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function CustomerList(props: Props) {
  return (
    <>
      <DesktopTable {...props} />
      <MobileList {...props} />
    </>
  );
}
