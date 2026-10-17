import { z } from "zod";
import { isValidISODate } from "@/lib/date";
import { MAC_REGEX, onlyDigits, parseCurrency } from "@/lib/format";

/**
 * Schema compartilhado entre o formulário (cliente) e as Server Actions
 * (servidor). Todos os campos são strings para que o tipo de entrada e saída
 * sejam idênticos; a normalização para o banco acontece em `toCustomerRow`.
 * O servidor SEMPRE revalida com este schema — a validação do cliente é só UX.
 */
export const customerFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Informe o nome do cliente")
    .max(120, "Nome muito longo"),
  phone: z
    .string()
    .trim()
    .refine((v) => v === "" || [10, 11].includes(onlyDigits(v).length), {
      message: "WhatsApp inválido. Use DDD + número",
    }),
  mac_address: z
    .string()
    .trim()
    .toUpperCase()
    .regex(MAC_REGEX, "MAC inválido. Formato: 00:1A:2B:3C:4D:5E"),
  app_name: z.string().trim().max(60, "Máximo de 60 caracteres"),
  plan_value: z
    .string()
    .trim()
    .min(1, "Informe o valor do plano")
    .refine((v) => {
      const n = parseCurrency(v);
      return Number.isFinite(n) && n >= 0 && n <= 99_999_999.99;
    }, "Valor inválido"),
  expires_at: z.string().refine(isValidISODate, "Data de vencimento inválida"),
  notes: z.string().trim().max(1000, "Máximo de 1000 caracteres"),
});

export type CustomerFormValues = z.infer<typeof customerFormSchema>;

export function toCustomerRow(values: CustomerFormValues) {
  const phone = onlyDigits(values.phone);
  return {
    name: values.name,
    phone: phone || null,
    mac_address: values.mac_address.toUpperCase(),
    app_name: values.app_name || null,
    plan_value: parseCurrency(values.plan_value),
    expires_at: values.expires_at,
    notes: values.notes || null,
  };
}

export const customerIdSchema = z.string().uuid("ID inválido");

export const renewModeSchema = z.enum(["auto", "from_expiry", "from_today"]);

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido").max(254),
  password: z.string().min(1, "Informe sua senha").max(128, "Senha muito longa"),
});
