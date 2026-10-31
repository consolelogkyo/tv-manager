import { z } from "zod";
import { MAX_CREDIT_UNIT_COST, MAX_PLAN_VALUE, MIN_CREDIT_UNIT_COST, MIN_PLAN_VALUE } from "@/lib/business";
import { isValidISODate } from "@/lib/date";
import { MAC_REGEX, onlyDigits, parseCurrency } from "@/lib/format";
import type { UserRole } from "@/lib/types";
import { isSafeHttpUrl, normalizeUrlInput } from "@/lib/tv-apps";

/**
 * Schema compartilhado entre o formulário (cliente) e as Server Actions
 * (servidor). Todos os campos são strings para que o tipo de entrada e saída
 * sejam idênticos; a normalização para o banco acontece em `toCustomerRow`.
 * O servidor SEMPRE revalida com este schema — a validação do cliente é só UX.
 *
 * As regras variam por cargo (`getCustomerFormSchema(role)`):
 * - admin:    aceita valor negativo (custo interno / desconto) e `payment_date`.
 * - reseller: valor não-negativo e `payment_date` é sempre descartado.
 */
const baseCustomerShape = {
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
  expires_at: z.string().refine(isValidISODate, "Data de vencimento inválida"),
  notes: z.string().trim().max(1000, "Máximo de 1000 caracteres"),
};

function planValueSchema(min: number, message: string) {
  return z
    .string()
    .trim()
    .min(1, "Informe o valor do plano")
    .refine((v) => {
      const n = parseCurrency(v);
      return Number.isFinite(n) && n >= min && n <= MAX_PLAN_VALUE;
    }, message);
}

/** Schema dos admins principais: permite valores negativos e data de pagamento alternativa. */
export const adminCustomerFormSchema = z.object({
  ...baseCustomerShape,
  plan_value: planValueSchema(MIN_PLAN_VALUE, "Valor inválido (mínimo -R$ 10.000,00)"),
  payment_date: z
    .string()
    .trim()
    .refine((v) => v === "" || isValidISODate(v), "Data de pagamento inválida"),
});

/**
 * Schema do revendedor: valor não-negativo. `payment_date` é exclusivo do admin,
 * então qualquer valor enviado por um revendedor é descartado (vira "").
 */
export const resellerCustomerFormSchema = z.object({
  ...baseCustomerShape,
  plan_value: planValueSchema(0, "Valor inválido"),
  payment_date: z
    .string()
    .optional()
    .transform(() => ""),
});

export type CustomerFormValues = z.infer<typeof adminCustomerFormSchema>;

/** Seleciona o schema pelo cargo. Ambos têm a mesma forma de entrada/saída. */
export function getCustomerFormSchema(role: UserRole): z.ZodType<CustomerFormValues, CustomerFormValues> {
  return role === "admin" ? adminCustomerFormSchema : (resellerCustomerFormSchema as z.ZodType<CustomerFormValues, CustomerFormValues>);
}

/**
 * Converte o formulário validado em colunas do banco. `payment_date` só é
 * incluído para admins — no UPDATE de um revendedor a coluna nem é tocada.
 * `owner_id`/`is_reseller` NUNCA vêm daqui: são definidos no servidor no INSERT.
 */
export function toCustomerRow(values: CustomerFormValues, role: UserRole) {
  const phone = onlyDigits(values.phone);
  const row = {
    name: values.name,
    phone: phone || null,
    mac_address: values.mac_address.toUpperCase(),
    app_name: values.app_name || null,
    plan_value: parseCurrency(values.plan_value),
    expires_at: values.expires_at,
    notes: values.notes || null,
  };
  if (role !== "admin") return row;
  return { ...row, payment_date: values.payment_date || null };
}

export const customerIdSchema = z.string().uuid("ID inválido");

/** Custo unitário do crédito (R$), arredondado para centavos. Usado no modal (UX) e na Server Action. */
export const creditUnitCostSchema = z
  .number({ message: "Informe um valor válido" }) // Zod 4 já rejeita NaN/Infinity
  .min(MIN_CREDIT_UNIT_COST, "O custo não pode ser negativo")
  .max(MAX_CREDIT_UNIT_COST, "O custo máximo é R$ 1.000,00")
  .transform((n) => Math.round(n * 100) / 100);

export const renewModeSchema = z.enum(["auto", "from_expiry", "from_today"]);

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido").max(254),
  password: z.string().min(1, "Informe sua senha").max(128, "Senha muito longa"),
});

/* ------------------------------------------------------- Catálogo de Apps --- */

/**
 * Schema do catálogo de apps por TV. Mesmo padrão dos clientes: usado no
 * formulário (UX) e SEMPRE revalidado nas Server Actions.
 */
export const tvAppFormSchema = z.object({
  tv_brand: z
    .string()
    .trim()
    .transform((v) => v.replace(/\s+/g, " "))
    .pipe(z.string().min(2, "Informe a marca/sistema da TV").max(80, "Máximo de 80 caracteres")),
  app_name: z.string().trim().min(1, "Informe o nome do app").max(60, "Máximo de 60 caracteres"),
  priority: z.enum(["1", "2", "3"], { message: "Escolha a prioridade" }),
  is_favorite: z.boolean(),
  license_info: z.string().trim().max(60, "Máximo de 60 caracteres"),
  activation_url: z
    .string()
    .trim()
    .max(500, "URL muito longa")
    .transform(normalizeUrlInput)
    .refine((v) => v === "" || isSafeHttpUrl(v), "Informe uma URL válida (https://...)"),
  notes: z.string().trim().max(1000, "Máximo de 1000 caracteres"),
});

export type TvAppFormValues = z.input<typeof tvAppFormSchema>;
export type TvAppFormOutput = z.output<typeof tvAppFormSchema>;

export function toTvAppRow(values: TvAppFormOutput) {
  return {
    tv_brand: values.tv_brand,
    app_name: values.app_name,
    priority: Number(values.priority),
    is_favorite: values.is_favorite,
    license_info: values.license_info || null,
    activation_url: values.activation_url || null,
    notes: values.notes || null,
  };
}

export const tvAppIdSchema = z.string().uuid("ID inválido");

export const priorityDirectionSchema = z.enum(["up", "down"]);

export const favoriteValueSchema = z.boolean();
