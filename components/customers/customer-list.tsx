"use client";

import { AppWindow, CalendarDays, Pencil, StickyNote } from "lucide-react";
import { CopyMacButton } from "@/components/customers/copy-mac-button";
import { DeleteButton } from "@/components/customers/delete-button";
import { RenewButton } from "@/components/customers/renew-button";
import { StatusBadge } from "@/components/customers/status-badge";
import type { EnrichedCustomer } from "@/components/customers/types";
import { WhatsAppLink } from "@/components/customers/whatsapp-link";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { describeDays, formatDateBR } from "@/lib/date";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  customers: EnrichedCustomer[];
  onEdit: (customer: EnrichedCustomer) => void;
};

const DAYS_TONE = {
  active: "text-muted-foreground",
  expiring: "text-warning",
  expired: "text-destructive",
} as const;

const ROW_ACCENT = {
  active: "before:bg-success/70",
  expiring: "before:bg-warning",
  expired: "before:bg-destructive",
} as const;

function EditButton({ customer, onEdit }: { customer: EnrichedCustomer; onEdit: Props["onEdit"] }) {
  return (
    <Button
      id={`edit-${customer.id}`}
      variant="ghost"
      size="icon-sm"
      onClick={() => onEdit(customer)}
      className="text-muted-foreground hover:bg-primary/15 hover:text-primary"
      aria-label={`Editar ${customer.name}`}
      title="Editar"
    >
      <Pencil />
    </Button>
  );
}

function ExpiryInfo({ customer }: { customer: EnrichedCustomer }) {
  return (
    <div className="flex flex-col">
      <span className="font-medium tabular-nums">{formatDateBR(customer.expires_at)}</span>
      <span className={cn("text-xs", DAYS_TONE[customer.status])}>{describeDays(customer.days)}</span>
    </div>
  );
}

/* --------------------------------------------------------------- Desktop --- */

function DesktopTable({ customers, onEdit }: Props) {
  return (
    <div className="hidden overflow-hidden rounded-2xl border border-border/70 bg-card/60 shadow-xl shadow-black/20 backdrop-blur-xl md:block">
      <Table>
        <TableHeader className="bg-muted/30">
          <TableRow className="hover:bg-transparent">
            <TableHead>Cliente</TableHead>
            <TableHead>MAC Address</TableHead>
            <TableHead>Aplicativo</TableHead>
            <TableHead className="text-right">Valor mensal</TableHead>
            <TableHead>Vencimento</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.map((customer) => (
            <TableRow key={customer.id}>
              <TableCell
                className={cn(
                  "relative max-w-[240px] before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-r-full",
                  ROW_ACCENT[customer.status],
                )}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="flex items-center gap-1.5 truncate font-medium">
                    <span className="truncate">{customer.name}</span>
                    {customer.notes && (
                      <span title={customer.notes} className="text-muted-foreground">
                        <StickyNote className="size-3.5" />
                        <span className="sr-only">Possui observações</span>
                      </span>
                    )}
                  </span>
                  <WhatsAppLink customer={customer} />
                </div>
              </TableCell>
              <TableCell>
                <CopyMacButton id={`copy-mac-${customer.id}`} value={customer.mac_address} />
              </TableCell>
              <TableCell className="text-muted-foreground">{customer.app_name || "—"}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">{formatCurrency(customer.plan_value)}</TableCell>
              <TableCell>
                <ExpiryInfo customer={customer} />
              </TableCell>
              <TableCell>
                <StatusBadge status={customer.status} days={customer.days} />
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-1">
                  <RenewButton customer={customer} />
                  <EditButton customer={customer} onEdit={onEdit} />
                  <DeleteButton customer={customer} />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/* ---------------------------------------------------------------- Mobile --- */

function MobileList({ customers, onEdit }: Props) {
  return (
    <ul className="grid gap-3 md:hidden">
      {customers.map((customer) => (
        <li
          key={customer.id}
          className={cn(
            "relative overflow-hidden rounded-2xl border border-border/70 bg-card/70 p-4 shadow-lg shadow-black/20 backdrop-blur-xl",
            "before:absolute before:inset-y-0 before:left-0 before:w-1",
            ROW_ACCENT[customer.status],
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{customer.name}</p>
              <WhatsAppLink customer={customer} />
            </div>
            <StatusBadge status={customer.status} days={customer.days} />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-start gap-2">
              <CalendarDays className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <ExpiryInfo customer={customer} />
            </div>
            <div className="text-right">
              <p className="font-display text-lg font-semibold tabular-nums">{formatCurrency(customer.plan_value)}</p>
              <p className="flex items-center justify-end gap-1 truncate text-xs text-muted-foreground">
                <AppWindow className="size-3.5 shrink-0" />
                <span className="truncate">{customer.app_name || "Sem app"}</span>
              </p>
            </div>
          </div>

          <div className="mt-3">
            <CopyMacButton id={`copy-mac-m-${customer.id}`} value={customer.mac_address} className="w-full justify-between py-2 text-sm" />
          </div>

          {customer.notes && (
            <p className="mt-3 line-clamp-2 rounded-lg bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              {customer.notes}
            </p>
          )}

          <div className="mt-3 flex items-center gap-2 border-t border-border/60 pt-3">
            <RenewButton customer={customer} className="h-10 flex-1 text-sm" />
            <EditButton customer={customer} onEdit={onEdit} />
            <DeleteButton customer={customer} />
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
