import { z } from "zod";
import { MAX_CREDIT_UNIT_COST, MAX_PLAN_VALUE } from "@/lib/business";
import { isValidISODate } from "@/lib/date";
import { MAC_REGEX, onlyDigits, parseCurrency } from "@/lib/format";
import { CREDIT_SOURCE_MODES, type UserRole } from "@/lib/types";
import { isSafeHttpUrl, normalizeUrlInput } from "@/lib/tv-apps";

/** UUID opcional vindo de um `<select>` ("" = nenhum). */
export const optionalUuidSchema = z
  .string()
  .trim()
  .refine((v) => v === "" || z.string().uuid().safeParse(v).success, "Seleção inválida");

export const creditSourceModeSchema = z.enum(CREDIT_SOURCE_MODES);

export const optionalUnitCostSchema = z
  .string()
  .trim()
  .refine((v) => {
    if (v === "") return true;
    const n = parseCurrency(v);
    return Number.isFinite(n) && n >= 0 && n <= MAX_CREDIT_UNIT_COST;
  }, "Custo do crédito inválido (R$ 0,00 a R$ 1.000,00)");

/**
 * Schema compartilhado entre o formulário (cliente) e as Server Actions
 * (servidor). Entrada e saída têm o mesmo tipo; a normalização para o banco
 * acontece em `toCustomerRow`. O servidor SEMPRE revalida com este schema —
 * a validação do cliente é só UX.
 *
 * As regras variam por cargo (`getCustomerFormSchema(role)`):
 * - admin:    painel, uso interno, troca de painel e `payment_date`.
 * - reseller: esses campos são sempre descartados (valores neutros).
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
  plan_value: z
    .string()
    .trim()
    .min(1, "Informe o valor do plano")
    .refine((v) => {
      const n = parseCurrency(v);
      return Number.isFinite(n) && n >= 0 && n <= MAX_PLAN_VALUE;
    }, "Valor inválido"),
};

/** Schema dos admins principais. */
export const adminCustomerFormSchema = z.object({
  ...baseCustomerShape,
  payment_date: z
    .string()
    .trim()
    .refine((v) => v === "" || isValidISODate(v), "Data de pagamento inválida"),
  panel_id: optionalUuidSchema,
  is_internal: z.boolean(),
  /** Troca de painel consumiu 1 crédito extra → lança despesa `panel_migration`. */
  charge_panel_migration: z.boolean(),
  /** Origem/custo do crédito no cadastro de novo cliente ou na despesa de troca de painel. */
  credit_source_mode: creditSourceModeSchema,
  credit_batch_id: optionalUuidSchema,
  custom_credit_cost: optionalUnitCostSchema,
});

/**
 * Schema do revendedor: campos exclusivos do admin são descartados
 * (viram valores neutros) mesmo que sejam enviados manualmente.
 */
export const resellerCustomerFormSchema = z.object({
  ...baseCustomerShape,
  payment_date: z
    .string()
    .optional()
    .transform(() => ""),
  panel_id: z
    .string()
    .optional()
    .transform(() => ""),
  is_internal: z
    .boolean()
    .optional()
    .transform(() => false),
  charge_panel_migration: z
    .boolean()
    .optional()
    .transform(() => false),
  credit_source_mode: z
    .string()
    .optional()
    .transform(() => "panel_default" as const),
  credit_batch_id: z
    .string()
    .optional()
    .transform(() => ""),
  custom_credit_cost: z
    .string()
    .optional()
    .transform(() => ""),
});

export type CustomerFormValues = z.infer<typeof adminCustomerFormSchema>;

/** Seleciona o schema pelo cargo. Ambos têm a mesma forma de entrada/saída. */
export function getCustomerFormSchema(role: UserRole): z.ZodType<CustomerFormValues, CustomerFormValues> {
  return role === "admin"
    ? adminCustomerFormSchema
    : (resellerCustomerFormSchema as unknown as z.ZodType<CustomerFormValues, CustomerFormValues>);
}

/**
 * Converte o formulário validado em colunas do banco. Campos exclusivos do
 * admin (`payment_date`, `panel_id`, `is_internal`) só entram para admins — no
 * UPDATE de um revendedor essas colunas nem são tocadas.
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
  return {
    ...row,
    // Uso interno: sem faturamento — o custo vem do crédito do painel.
    plan_value: values.is_internal ? 0 : row.plan_value,
    payment_date: values.payment_date || null,
    panel_id: values.panel_id || null,
    is_internal: values.is_internal,
  };
}

export const customerIdSchema = z.string().uuid("ID inválido");

export const renewModeSchema = z.enum(["auto", "from_expiry", "from_today"]);

export const renewMonthsSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(6),
  z.literal(12),
]);

export const renewCustomerInputSchema = z.object({
  customerId: customerIdSchema,
  months: renewMonthsSchema,
  screens: z.number().int().min(1, "Mínimo de 1 tela").max(10, "Máximo de 10 telas"),
  mode: renewModeSchema,
  expires_at: z.string().refine(isValidISODate, "Data de vencimento inválida"),
  payment_date: z.string().refine(isValidISODate, "Data de pagamento inválida"),
  gross_amount: z
    .string()
    .trim()
    .min(1, "Informe o valor da renovação")
    .refine((v) => {
      const n = parseCurrency(v);
      return Number.isFinite(n) && n >= 0 && n <= MAX_PLAN_VALUE;
    }, "Valor inválido"),
  credits_used: z.number().int().min(0, "Créditos não podem ser negativos").max(120, "Máximo de 120 créditos"),
  update_plan_value: z.boolean(),
  credit_source_mode: creditSourceModeSchema.optional().default("batch"),
  credit_batch_id: optionalUuidSchema.optional().default(""),
  custom_credit_cost: optionalUnitCostSchema.optional().default(""),
});

export type RenewCustomerInput = z.infer<typeof renewCustomerInputSchema>;

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
