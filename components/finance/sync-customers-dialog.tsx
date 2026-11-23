"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckSquare, Loader2, RefreshCw, Square, Users } from "lucide-react";
import { toast } from "sonner";
import { importCustomersToMonth } from "@/app/actions/finance";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InfoTip } from "@/components/ui/info-tip";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { getBillingAmounts, round2 } from "@/lib/business";
import { formatDateBR, toAppDateISO } from "@/lib/date";
import { MAX_IMPORT_BATCH } from "@/lib/finance-validations";
import { formatCurrency } from "@/lib/format";
import { formatMonthLabel, monthBounds } from "@/lib/month";
import type { BillingEvent, FinanceCustomer, ImportMode, Panel } from "@/lib/types";
import { cn } from "@/lib/utils";

type Candidate = FinanceCustomer & {
  createdDate: string;
  createdAfterMonth: boolean;
  panelName: string | null;
  creditCost: number;
  gross: number;
  commission: number;
  internal: boolean;
};

/**
 * "Sincronizar clientes atuais neste mês": lista clientes da carteira que
 * estavam ativos no mês e ainda não têm lançamento nele, para importar em 1 clique.
 */
export function SyncCustomersDialog({
  open,
  onOpenChange,
  month,
  customers,
  events,
  panels,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  month: string;
  customers: FinanceCustomer[];
  events: BillingEvent[];
  panels: Panel[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {/* O conteúdo só monta com o modal aberto: a seleção reinicia a cada abertura. */}
        <SyncContent
          month={month}
          customers={customers}
          events={events}
          panels={panels}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function SyncContent({
  month,
  customers,
  events,
  panels,
  onDone,
}: {
  month: string;
  customers: FinanceCustomer[];
  events: BillingEvent[];
  panels: Panel[];
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<ImportMode>("auto");

  const candidates = useMemo<Candidate[]>(() => {
    const { start, end } = monthBounds(month);
    const panelById = new Map(panels.map((p) => [p.id, p]));
    const existing = new Set(
      events.filter((e) => e.reference_month === month && e.customer_id).map((e) => e.customer_id as string),
    );
    return customers
      .filter((c) => !existing.has(c.id))
      // Estava na carteira em algum momento do mês: não cancelado antes do início e vencimento ≥ início.
      .filter((c) => (!c.canceled_at || c.canceled_at >= start) && c.expires_at >= start)
      .map((c) => {
        const panel = c.panel_id ? panelById.get(c.panel_id) : undefined;
        const amounts = getBillingAmounts(c);
        const createdDate = toAppDateISO(c.created_at);
        return {
          ...c,
          createdDate,
          createdAfterMonth: createdDate > end,
          panelName: panel?.name ?? null,
          creditCost: panel?.credit_cost ?? 0,
          gross: amounts.gross_amount,
          commission: amounts.commission_amount,
          internal: amounts.is_internal,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [customers, events, panels, month]);

  // Por padrão, marca quem já estava cadastrado até o fim do mês.
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(candidates.filter((c) => !c.createdAfterMonth).map((c) => c.id)),
  );

  const chosen = candidates.filter((c) => selected.has(c.id));
  const totals = chosen.reduce(
    (acc, c) => ({ gross: acc.gross + c.gross, commission: acc.commission + c.commission, credits: acc.credits + c.creditCost }),
    { gross: 0, commission: 0, credits: 0 },
  );
  const tooMany = chosen.length > MAX_IMPORT_BATCH;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submit() {
    if (chosen.length === 0 || tooMany) return;
    startTransition(async () => {
      const result = await importCustomersToMonth({ month, customerIds: chosen.map((c) => c.id), mode });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      onDone();
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <RefreshCw className="size-4 text-muted-foreground" strokeWidth={1.75} />
          Sincronizar clientes em {formatMonthLabel(month)}
        </DialogTitle>
        <DialogDescription>
          Clientes da carteira que estavam ativos no mês e ainda não têm lançamento nele. Os valores vêm do cadastro
          atual (plano, comissão e custo do crédito do painel).
        </DialogDescription>
      </DialogHeader>

      {candidates.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border px-6 py-10 text-center">
          <Users className="mb-2 size-6 text-subtle-foreground" strokeWidth={1.5} />
          <p className="font-medium">Tudo sincronizado!</p>
          <p className="text-sm text-muted-foreground">Nenhum cliente ativo sem lançamento neste mês.</p>
        </div>
      ) : (
        <div className="-mx-1 flex min-h-0 flex-col gap-3 overflow-y-auto px-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1.5 sm:w-72">
              <div className="flex items-center gap-1">
                <Label htmlFor="sync-mode">Tipo dos lançamentos</Label>
                <InfoTip term="syncMode" align="start" />
              </div>
              <NativeSelect id="sync-mode" value={mode} onChange={(e) => setMode(e.target.value as ImportMode)}>
                <option value="auto">Automático (novo se cadastrado no mês)</option>
                <option value="renewal">Todos como renovação</option>
                <option value="new_subscription">Todos como assinatura nova</option>
              </NativeSelect>
            </div>
            <div className="flex gap-2">
              <Button
                id="sync-select-all"
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelected(new Set(candidates.map((c) => c.id)))}
              >
                <CheckSquare /> Todos
              </Button>
              <Button id="sync-select-none" type="button" variant="outline" size="sm" onClick={() => setSelected(new Set())}>
                <Square /> Nenhum
              </Button>
            </div>
          </div>

          <ul className="grid max-h-[45dvh] gap-1 overflow-y-auto rounded-lg border border-border bg-background p-1">
            {candidates.map((c) => {
              const checked = selected.has(c.id);
              return (
                <li key={c.id}>
                  <label
                    htmlFor={`sync-${c.id}`}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors",
                      checked ? "border-border bg-muted" : "border-transparent hover:bg-muted/40",
                    )}
                  >
                    <input
                      id={`sync-${c.id}`}
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(c.id)}
                      className="size-4 shrink-0 cursor-pointer accent-primary"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate font-medium">{c.name}</span>
                        {c.internal && <Badge variant="outline">Uso interno</Badge>}
                        {c.is_reseller && <Badge variant="outline">Revenda</Badge>}
                        {c.createdAfterMonth && (
                          <Badge variant="outline">
                            cadastrado em {formatDateBR(c.createdDate)}
                          </Badge>
                        )}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {c.panelName ?? "Sem painel"} · vence {formatDateBR(c.expires_at)}
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-xs tabular-nums">
                      <span className="block font-medium">{formatCurrency(c.gross)}</span>
                      <span className="block text-subtle-foreground">−{formatCurrency(c.creditCost)} crédito</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>

          <p className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
            <strong className="text-foreground">{chosen.length}</strong> selecionado(s) · Bruto{" "}
            <strong className="text-foreground tabular-nums">{formatCurrency(round2(totals.gross))}</strong> · Comissões{" "}
            <strong className="text-foreground tabular-nums">{formatCurrency(round2(totals.commission))}</strong> · Créditos{" "}
            <strong className="text-foreground tabular-nums">{formatCurrency(round2(totals.credits))}</strong>
            {tooMany && (
              <span className="mt-1 block text-destructive">Máximo de {MAX_IMPORT_BATCH} clientes por importação.</span>
            )}
          </p>
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
          Fechar
        </Button>
        {candidates.length > 0 && (
          <Button id="sync-submit" type="button" onClick={submit} disabled={pending || chosen.length === 0 || tooMany}>
            {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            Importar {chosen.length} cliente{chosen.length === 1 ? "" : "s"}
          </Button>
        )}
      </DialogFooter>
    </>
  );
}
