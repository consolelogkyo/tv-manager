import { describeDays, formatDateBR } from "@/lib/date";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatCurrency(value: number): string {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0);
}

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/* ------------------------------------------------------------------ MAC --- */

/** Máscara automática `XX:XX:XX:XX:XX:XX` em maiúsculas (apenas hexadecimais). */
export function maskMac(value: string): string {
  const hex = value.replace(/[^0-9a-fA-F]/g, "").toUpperCase().slice(0, 12);
  return hex.match(/.{1,2}/g)?.join(":") ?? "";
}

export const MAC_REGEX = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/;

/* -------------------------------------------------------------- Telefone --- */

/** Máscara `(11) 98765-4321` ou `(11) 3456-7890`. */
export function maskPhone(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function formatPhone(digits: string | null | undefined): string {
  if (!digits) return "";
  // Números salvos já com DDI 55
  const local = digits.length > 11 && digits.startsWith("55") ? digits.slice(2) : digits;
  return maskPhone(local);
}

/* ---------------------------------------------------------------- Moeda --- */

/** Máscara de moeda enquanto digita: "4990" → "49,90". */
export function maskCurrency(value: string): string {
  const digits = onlyDigits(value).replace(/^0+(?=\d)/, "").slice(0, 10);
  if (!digits) return "";
  const cents = Number.parseInt(digits, 10);
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** "1.234,56" → 1234.56 */
export function parseCurrency(value: string): number {
  const normalized = value.replace(/\./g, "").replace(",", ".").trim();
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : Number.NaN;
}

/** 49.9 → "49,90" (para preencher o formulário de edição) */
export function numberToCurrencyInput(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** 12.345 → "12,3%" */
export function formatPercent(value: number, fractionDigits = 1): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe.toLocaleString("pt-BR", { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })}%`;
}

/* ------------------------------------------------------------- WhatsApp --- */

/** Número com DDI 55 para o wa.me, ou `null` se inválido. Só dígitos chegam à URL. */
function toWhatsAppNumber(phone: string): string | null {
  const digits = onlyDigits(phone);
  if (digits.length < 10) return null;
  return digits.length > 11 && digits.startsWith("55") ? digits : `55${digits}`;
}

function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}

export function buildWhatsAppLink(params: {
  phone: string;
  name: string;
  expiresAt: string;
  daysRemaining: number;
  planValue: number;
}): string | null {
  const withCountry = toWhatsAppNumber(params.phone);
  if (!withCountry) return null;

  const firstName = firstNameOf(params.name);
  const date = formatDateBR(params.expiresAt);
  // Lançamentos internos (valor ≤ 0) nunca devem expor valor na mensagem.
  const hasValue = params.planValue > 0;
  const value = formatCurrency(params.planValue);

  const message =
    params.daysRemaining < 0
      ? `Olá, ${firstName}! Tudo bem? Sua assinatura de TV venceu em ${date} (${describeDays(
          params.daysRemaining,
        ).toLowerCase()}). ${hasValue ? `Para reativar, o valor é ${value}. ` : ""}É só me responder por aqui que já libero pra você! 📺`
      : `Olá, ${firstName}! Tudo bem? Passando para lembrar que sua assinatura de TV vence em ${date} (${describeDays(
          params.daysRemaining,
        ).toLowerCase()}). ${hasValue ? `O valor da renovação é ${value}. ` : ""}Quer que eu já renove pra você? 📺`;

  return `https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`;
}

/** Mensagem de recuperação para clientes em churn ("sentimos sua falta"). */
export function buildRecoveryWhatsAppLink(params: { phone: string; name: string }): string | null {
  const withCountry = toWhatsAppNumber(params.phone);
  if (!withCountry) return null;
  const firstName = firstNameOf(params.name);
  const message = `Oi ${firstName}, tudo bem? Sentimos sua falta por aqui! 📺 Se quiser voltar a assistir, consigo reativar sua assinatura agora mesmo — é só me responder.`;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`;
}
