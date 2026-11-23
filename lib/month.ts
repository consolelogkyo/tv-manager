import { getTodayISO } from "@/lib/date";

/** Mês de referência no formato `YYYY-MM`. */
export const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;

const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

function split(month: string): [number, number] {
  const [y, m] = month.split("-").map(Number);
  return [y, m];
}

export function isValidMonth(value: unknown): value is string {
  if (typeof value !== "string" || !MONTH_REGEX.test(value)) return false;
  const [y] = split(value);
  return y >= MIN_YEAR && y <= MAX_YEAR;
}

/** Mês atual (`YYYY-MM`) no fuso da aplicação. */
export function getCurrentMonth(today: string = getTodayISO()): string {
  return today.slice(0, 7);
}

/** `YYYY-MM-DD` → `YYYY-MM` */
export function monthOf(isoDate: string): string {
  return isoDate.slice(0, 7);
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = split(month);
  const index = y * 12 + (m - 1) + delta;
  const ny = Math.floor(index / 12);
  const nm = (index % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

export function daysInMonth(month: string): number {
  const [y, m] = split(month);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Primeiro e último dia do mês (`YYYY-MM-DD`). */
export function monthBounds(month: string): { start: string; end: string } {
  return {
    start: `${month}-01`,
    end: `${month}-${String(daysInMonth(month)).padStart(2, "0")}`,
  };
}

/** Dia `day` dentro do mês, limitado ao último dia (ex.: 31 em fevereiro → 28/29). */
export function dayInMonth(month: string, day: number): string {
  const clamped = Math.min(Math.max(1, Math.trunc(day) || 1), daysInMonth(month));
  return `${month}-${String(clamped).padStart(2, "0")}`;
}

/** `2026-10` → `Outubro/2026` */
export function formatMonthLabel(month: string): string {
  const [y, m] = split(month);
  return `${MONTH_NAMES[m - 1] ?? "?"}/${y}`;
}

/** `2026-10` → `Out/26` */
export function formatMonthShort(month: string): string {
  const [y, m] = split(month);
  return `${(MONTH_NAMES[m - 1] ?? "?").slice(0, 3)}/${String(y).slice(2)}`;
}

/** Ordena e remove duplicados de uma lista de meses válidos. */
export function uniqueSortedMonths(months: Iterable<string>): string[] {
  return [...new Set([...months].filter(isValidMonth))].sort();
}
