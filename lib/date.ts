import { addDays, addMonths, differenceInCalendarDays, format, parseISO } from "date-fns";

/**
 * Fuso horário de referência para cálculo de vencimentos.
 * Usar um fuso fixo garante que servidor (ex.: Vercel em UTC) e navegador
 * cheguem exatamente ao mesmo "hoje", evitando divergências perto da meia-noite.
 */
export const APP_TIMEZONE = process.env.NEXT_PUBLIC_APP_TIMEZONE || "America/Sao_Paulo";

export const EXPIRING_WINDOW_DAYS = 3;

export type CustomerStatus = "active" | "expiring" | "expired";

/** Data de hoje no fuso da aplicação, no formato ISO `YYYY-MM-DD`. */
export function getTodayISO(): string {
  // "en-CA" formata como YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function toISO(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function addDaysISO(isoDate: string, days: number): string {
  return toISO(addDays(parseISO(isoDate), days));
}

export function addMonthsISO(isoDate: string, months: number): string {
  return toISO(addMonths(parseISO(isoDate), months));
}

/** Dias entre hoje e o vencimento (negativo = vencido há N dias). */
export function getDaysRemaining(expiresAt: string, today: string): number {
  return differenceInCalendarDays(parseISO(expiresAt), parseISO(today));
}

export function getStatus(expiresAt: string, today: string): CustomerStatus {
  const days = getDaysRemaining(expiresAt, today);
  if (days < 0) return "expired";
  if (days <= EXPIRING_WINDOW_DAYS) return "expiring";
  return "active";
}

/** `YYYY-MM-DD` → `DD/MM/YYYY` */
export function formatDateBR(isoDate: string): string {
  return format(parseISO(isoDate), "dd/MM/yyyy");
}

/** Texto amigável de dias restantes/atrasados. */
export function describeDays(days: number): string {
  if (days === 0) return "Vence hoje";
  if (days === 1) return "Vence amanhã";
  if (days > 1) return `Faltam ${days} dias`;
  if (days === -1) return "Venceu ontem";
  return `Vencido há ${Math.abs(days)} dias`;
}

export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = parseISO(value);
  return !Number.isNaN(parsed.getTime()) && toISO(parsed) === value;
}
