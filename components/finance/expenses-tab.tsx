"use client";

import { useMemo, useState } from "react";
import { Link2, Pencil, Plus, ReceiptText, X } from "lucide-react";
import { deleteExpense } from "@/app/actions/expenses";
import { ConfirmDeleteButton } from "@/components/finance/confirm-delete-button";
import { ExpenseFormDialog } from "@/components/finance/expense-form-dialog";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/ui/info-tip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { round2 } from "@/lib/business";
import { formatDateBR } from "@/lib/date";
import { EXPENSE_CATEGORY_META } from "@/lib/expenses";
import { formatCurrency } from "@/lib/format";
import { formatMonthLabel, formatMonthShort } from "@/lib/month";
import type { Expense, ExpenseCategory, FinanceData } from "@/lib/types";
import { EXPENSE_CATEGORIES } from "@/lib/types";
import { cn } from "@/lib/utils";

type Scope = "month" | "all";

function CategoryBadge({ category }: { category: ExpenseCategory }) {
  const meta = EXPENSE_CATEGORY_META[category];
  return (
    <span className="inline-flex min-w-0 items-center gap-2 text-[13px] whitespace-nowrap text-foreground">
      <span className={cn("size-2 shrink-0 rounded-full", meta.dot)} aria-hidden="true" />
      {meta.label}
    </span>
  );
}

export function ExpensesTab({ data, month, today }: { data: FinanceData; month: string; today: string }) {
  const [scope, setScope] = useState<Scope>("month");
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);

  const customerNames = useMemo(() => new Map(data.customers.map((c) => [c.id, c.name])), [data.customers]);
  const panelNames = useMemo(() => new Map(data.panels.map((p) => [p.id, p.name])), [data.panels]);

  const scoped = useMemo(
    () => (scope === "month" ? data.expenses.filter((x) => x.reference_month === month) : data.expenses),
    [data.expenses, scope, month],
  );
  const visible = categoryFilter ? scoped.filter((x) => x.category === categoryFilter) : scoped;

  const byCategory = useMemo(() => {
    const map = new Map<ExpenseCategory, { count: number; amount: number }>();
    for (const x of scoped) {
      const entry = map.get(x.category) ?? { count: 0, amount: 0 };
      entry.count += 1;
      entry.amount += x.amount;
      map.set(x.category, entry);
    }
    return EXPENSE_CATEGORIES.flatMap((c) => {
      const entry = map.get(c);
      return entry ? [{ category: c, count: entry.count, amount: round2(entry.amount) }] : [];
    });
  }, [scoped]);
  const total = round2(scoped.reduce((sum, x) => sum + x.amount, 0));

  function openForm(expense: Expense | null) {
    setEditing(expense);
    setFormOpen(true);
  }

  const linkText = (x: Expense) =>
    [x.customer_id ? customerNames.get(x.customer_id) : null, x.panel_id ? panelNames.get(x.panel_id) : null]
      .filter(Boolean)
      .join(" · ");

  const deleteProps = (x: Expense, suffix = "") => ({
    id: `fin-expense-delete${suffix}-${x.id}`,
    ariaLabel: `Excluir despesa ${x.title}`,
    title: "Excluir despesa",
    description: (
      <>
        <strong className="text-foreground">{x.title}</strong> ({formatCurrency(x.amount)}) será removida do mês{" "}
        {formatMonthLabel(x.reference_month)}.
      </>
    ),
    onConfirm: () => deleteExpense(x.id),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" aria-label="Período das despesas" className="inline-flex w-full gap-1 rounded-lg border border-border bg-card p-1 sm:w-auto">
          {(
            [
              ["month", formatMonthLabel(month)],
              ["all", "Todos os meses"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              id={`fin-expenses-scope-${value}`}
              aria-selected={scope === value}
              onClick={() => setScope(value)}
              className={cn(
                "h-8 flex-1 cursor-pointer rounded-md px-3 text-[13px] font-medium whitespace-nowrap transition-colors duration-150 sm:flex-none",
                scope === value
                  ? "bg-muted text-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <Button id="fin-expense-new" onClick={() => openForm(null)}>
          <Plus /> Nova despesa
        </Button>
      </div>

      {/* Resumo por categoria */}
      <section aria-labelledby="fin-expenses-summary" className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="fin-expenses-summary" className="flex items-center gap-1 text-[15px] font-medium">
            Total por categoria
            <InfoTip term="expenseCategories" />
          </h3>
          <p className="text-xl font-medium tabular-nums">{formatCurrency(total)}</p>
        </div>
        {byCategory.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma despesa extra no período</p>
        ) : (
          <>
            <div className="mb-4 flex h-2 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
              {byCategory.map((c) => (
                <span
                  key={c.category}
                  className={EXPENSE_CATEGORY_META[c.category].bar}
                  style={{ width: `${total > 0 ? (c.amount / total) * 100 : 0}%` }}
                />
              ))}
            </div>
            <ul className="-mx-2">
              {[...byCategory].sort((x, y) => y.amount - x.amount).map((c) => {
                const selected = categoryFilter === c.category;
                return (
                  <li key={c.category}>
                    <button
                      type="button"
                      id={`fin-expenses-filter-${c.category}`}
                      aria-pressed={selected}
                      onClick={() => setCategoryFilter(selected ? null : c.category)}
                      className={cn(
                        "grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 rounded-md px-2 py-2 text-left text-sm transition-colors duration-150",
                        selected ? "bg-muted" : "hover:bg-muted/50",
                      )}
                    >
                      <CategoryBadge category={c.category} />
                      <span className="font-mono text-xs text-subtle-foreground tabular-nums">
                        {c.count} · {total > 0 ? Math.round((c.amount / total) * 100) : 0}%
                      </span>
                      <span className="w-24 text-right font-medium tabular-nums">{formatCurrency(c.amount)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {categoryFilter && (
              <Button id="fin-expenses-filter-clear" variant="ghost" size="sm" className="mt-2 text-muted-foreground" onClick={() => setCategoryFilter(null)}>
                <X /> Limpar filtro
              </Button>
            )}
          </>
        )}
      </section>

      {/* Lista */}
      {visible.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border px-6 py-10 text-center">
          <ReceiptText className="mb-2 size-6 text-subtle-foreground" strokeWidth={1.5} />
          <p className="font-medium">Nenhuma despesa encontrada</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Lance chips de WhatsApp, licenças, créditos extras de troca de painel e outros custos invisíveis.
          </p>
          <Button id="fin-expense-empty-new" variant="outline" className="mt-4" onClick={() => openForm(null)}>
            <Plus /> Nova despesa
          </Button>
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Mês ref.</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-24 text-right">
                    <span className="sr-only">Ações</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((x) => (
                  <TableRow key={x.id}>
                    <TableCell className="text-muted-foreground tabular-nums">{formatDateBR(x.expense_date)}</TableCell>
                    <TableCell className="max-w-[320px]">
                      <p className="truncate font-medium" title={x.title}>
                        {x.title}
                      </p>
                      {(linkText(x) || x.notes) && (
                        <p className="truncate text-xs text-subtle-foreground" title={x.notes ?? undefined}>
                          {linkText(x) && (
                            <span className="inline-flex items-center gap-1">
                              <Link2 className="size-3" aria-hidden="true" />
                              {linkText(x)}
                            </span>
                          )}
                          {linkText(x) && x.notes ? " · " : ""}
                          {x.notes}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <CategoryBadge category={x.category} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatMonthShort(x.reference_month)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      −{formatCurrency(x.amount)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          id={`fin-expense-edit-${x.id}`}
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openForm(x)}
                          className="text-muted-foreground"
                          aria-label={`Editar despesa ${x.title}`}
                          title="Editar"
                        >
                          <Pencil />
                        </Button>
                        <ConfirmDeleteButton {...deleteProps(x)} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ul className="grid gap-3 md:hidden">
            {visible.map((x) => (
              <li key={x.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{x.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateBR(x.expense_date)} · ref. {formatMonthShort(x.reference_month)}
                    </p>
                  </div>
                  <span className="text-base font-medium tabular-nums">
                    −{formatCurrency(x.amount)}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <CategoryBadge category={x.category} />
                  {linkText(x) && <span className="truncate text-xs text-muted-foreground">{linkText(x)}</span>}
                </div>
                {x.notes && <p className="mt-2 line-clamp-2 rounded-lg bg-background px-3 py-2 text-xs text-muted-foreground">{x.notes}</p>}
                <div className="mt-3 flex items-center justify-end gap-1 border-t border-border pt-3">
                  <Button id={`fin-expense-edit-m-${x.id}`} variant="outline" size="sm" onClick={() => openForm(x)}>
                    <Pencil /> Editar
                  </Button>
                  <ConfirmDeleteButton {...deleteProps(x, "-m")} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <ExpenseFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        expense={editing}
        month={month}
        today={today}
        customers={data.customers}
        panels={data.panels}
        batches={data.batches}
      />
    </div>
  );
}
