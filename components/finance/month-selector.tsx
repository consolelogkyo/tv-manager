"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/ui/info-tip";
import { MonthPicker } from "@/components/ui/month-picker";
import { formatMonthLabel, shiftMonth } from "@/lib/month";

/**
 * Seletor do mês de referência: setas para o mês anterior/seguinte e uma
 * grade de meses (com ponto nos meses que têm lançamentos) para pular para
 * qualquer mês — inclusive meses antigos, para lançar o histórico.
 */
export function MonthSelector({
  month,
  dataMonths,
  currentMonth,
  onChange,
}: {
  month: string;
  /** Meses que possuem lançamentos/despesas — definem a numeração "Mês 1, Mês 2...". */
  dataMonths: string[];
  currentMonth: string;
  onChange: (month: string) => void;
}) {
  const monthNumber = dataMonths.indexOf(month) + 1;
  const triggerLabel = [
    monthNumber > 0 ? `Mês ${monthNumber} · ${formatMonthLabel(month)}` : formatMonthLabel(month),
    month === currentMonth ? "(atual)" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section aria-label="Mês de referência" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <Button
          id="finance-month-prev"
          variant="outline"
          size="icon"
          onClick={() => onChange(shiftMonth(month, -1))}
          aria-label={`Mês anterior (${formatMonthLabel(shiftMonth(month, -1))})`}
          title="Mês anterior"
        >
          <ChevronLeft />
        </Button>
        <div className="min-w-0 flex-1 sm:w-64 sm:flex-none">
          <MonthPicker
            id="finance-month-picker"
            value={month}
            displayValue={triggerLabel}
            onChange={onChange}
            markedMonths={dataMonths}
            currentMonth={currentMonth}
            triggerClassName="h-9 font-medium"
          />
        </div>
        <Button
          id="finance-month-next"
          variant="outline"
          size="icon"
          onClick={() => onChange(shiftMonth(month, 1))}
          aria-label={`Próximo mês (${formatMonthLabel(shiftMonth(month, 1))})`}
          title="Próximo mês"
        >
          <ChevronRight />
        </Button>
        {month !== currentMonth && (
          <Button id="finance-month-today" variant="outline" size="sm" className="text-primary-ink" onClick={() => onChange(currentMonth)}>
            Mês atual
          </Button>
        )}
      </div>

      <span className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-border bg-muted px-3 py-1.5 text-[13px] text-muted-foreground">
        {monthNumber > 0 ? (
          <>
            <span className="font-medium text-foreground">Mês {monthNumber}</span>
            <span>de {dataMonths.length} com lançamentos</span>
          </>
        ) : (
          <span>Mês sem lançamentos</span>
        )}
        <InfoTip term="monthNumber" align="end" />
      </span>
    </section>
  );
}
