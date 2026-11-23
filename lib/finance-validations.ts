import { z } from "zod";
import { MAX_CREDIT_UNIT_COST, MAX_PLAN_VALUE, MIN_CREDIT_UNIT_COST } from "@/lib/business";
import { isValidISODate } from "@/lib/date";
import { parseCurrency } from "@/lib/format";
import { MONTH_REGEX } from "@/lib/month";
import { BILLING_EVENT_TYPES, EXPENSE_CATEGORIES } from "@/lib/types";
import { optionalUuidSchema } from "@/lib/validations";

/**
 * Schemas do módulo financeiro (painéis, despesas e Livro-Razão).
 * Mesmo padrão dos clientes: os formulários usam strings/booleans (entrada =
 * saída) e as Server Actions SEMPRE revalidam e convertem com `to*Row`.
 */

export const uuidSchema = z.string().uuid("ID inválido");

export const monthSchema = z
  .string()
  .regex(MONTH_REGEX, "Mês inválido (use AAAA-MM)")
  .refine((v) => {
    const year = Number(v.slice(0, 4));
    return year >= 2000 && year <= 2100;
  }, "Mês fora do intervalo permitido");

const isoDateSchema = (message: string) => z.string().refine(isValidISODate, message);

/** Valor monetário mascarado ("1.234,56") dentro de [min, max]. */
function moneySchema(min: number, max: number, message: string) {
  return z
    .string()
    .trim()
    .min(1, "Informe o valor")
    .refine((v) => {
      const n = parseCurrency(v);
      return Number.isFinite(n) && n >= min && n <= max;
    }, message);
}

const notesSchema = z.string().trim().max(500, "Máximo de 500 caracteres");

/* --------------------------------------------------------------- Painéis --- */

export const panelFormSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do painel").max(60, "Máximo de 60 caracteres"),
  credit_cost: moneySchema(MIN_CREDIT_UNIT_COST, MAX_CREDIT_UNIT_COST, "Custo entre R$ 0,00 e R$ 1.000,00"),
  is_active: z.boolean(),
  notes: notesSchema,
});

export type PanelFormValues = z.infer<typeof panelFormSchema>;

export function toPanelRow(values: PanelFormValues) {
  return {
    name: values.name.replace(/\s+/g, " "),
    credit_cost: parseCurrency(values.credit_cost),
    is_active: values.is_active,
    notes: values.notes || null,
  };
}

/* ----------------------------------------------------- Lotes de Crédito --- */

export const creditBatchFormSchema = z
  .object({
    panel_id: uuidSchema,
    label: z.string().trim().min(2, "Identifique o lote").max(80, "Máximo de 80 caracteres"),
    unit_cost: moneySchema(MIN_CREDIT_UNIT_COST, MAX_CREDIT_UNIT_COST, "Custo entre R$ 0,00 e R$ 1.000,00"),
    quantity_total: z.number().int().min(1, "Mínimo de 1 crédito").max(10000, "Máximo de 10.000 créditos"),
    quantity_remaining: z.number().int().min(0, "Saldo não pode ser negativo").max(10000, "Máximo de 10.000 créditos"),
    purchased_at: isoDateSchema("Data inválida"),
    is_active: z.boolean(),
    notes: notesSchema,
  })
  .refine((v) => v.quantity_remaining <= v.quantity_total, {
    message: "Saldo restante não pode superar a quantidade comprada",
    path: ["quantity_remaining"],
  });

export type CreditBatchFormValues = z.infer<typeof creditBatchFormSchema>;

export function toCreditBatchRow(values: CreditBatchFormValues) {
  return {
    panel_id: values.panel_id,
    label: values.label.replace(/\s+/g, " "),
    unit_cost: parseCurrency(values.unit_cost),
    quantity_total: values.quantity_total,
    quantity_remaining: values.quantity_remaining,
    purchased_at: values.purchased_at,
    is_active: values.is_active,
    notes: values.notes || null,
  };
}

/* ------------------------------------------------------------- Despesas --- */

export const expenseFormSchema = z.object({
  title: z.string().trim().min(2, "Descreva a despesa").max(120, "Máximo de 120 caracteres"),
  category: z.enum(EXPENSE_CATEGORIES, { message: "Escolha a categoria" }),
  amount: moneySchema(0.01, MAX_PLAN_VALUE, "Informe um valor maior que zero"),
  expense_date: isoDateSchema("Data inválida"),
  reference_month: monthSchema,
  customer_id: optionalUuidSchema,
  panel_id: optionalUuidSchema,
  credits_used: z.number().int().min(0, "Créditos não podem ser negativos").max(120, "Máximo de 120 créditos"),
  credit_batch_id: optionalUuidSchema,
  notes: notesSchema,
});

export type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

export function toExpenseRow(values: ExpenseFormValues) {
  return {
    title: values.title,
    category: values.category,
    amount: parseCurrency(values.amount),
    expense_date: values.expense_date,
    reference_month: values.reference_month,
    customer_id: values.customer_id || null,
    panel_id: values.panel_id || null,
    credits_used: values.credits_used,
    credit_batch_id: values.credit_batch_id || null,
    notes: values.notes || null,
  };
}

/* ---------------------------------------------------------- Livro-Razão --- */

export const billingEventFormSchema = z.object({
  customer_id: optionalUuidSchema,
  customer_name_snapshot: z.string().trim().min(2, "Informe o nome do cliente").max(120, "Nome muito longo"),
  panel_id: optionalUuidSchema,
  event_type: z.enum(BILLING_EVENT_TYPES, { message: "Escolha o tipo" }),
  reference_month: monthSchema,
  event_date: isoDateSchema("Data inválida"),
  gross_amount: moneySchema(0, MAX_PLAN_VALUE, "Valor inválido"),
  commission_amount: moneySchema(0, MAX_PLAN_VALUE, "Valor inválido"),
  credit_cost: moneySchema(MIN_CREDIT_UNIT_COST, MAX_PLAN_VALUE, "Custo inválido"),
  credits_used: z.number().int().min(1, "Mínimo de 1 crédito").max(120, "Máximo de 120 créditos"),
  credit_batch_id: optionalUuidSchema,
  is_reseller: z.boolean(),
  is_internal: z.boolean(),
  notes: notesSchema,
});

export type BillingEventFormValues = z.infer<typeof billingEventFormSchema>;

export function toBillingEventRow(values: BillingEventFormValues) {
  return {
    customer_id: values.customer_id || null,
    customer_name_snapshot: values.customer_name_snapshot,
    panel_id: values.panel_id || null,
    event_type: values.event_type,
    reference_month: values.reference_month,
    event_date: values.event_date,
    // Uso interno nunca gera receita nem comissão.
    gross_amount: values.is_internal ? 0 : parseCurrency(values.gross_amount),
    commission_amount: values.is_internal ? 0 : parseCurrency(values.commission_amount),
    credit_cost: parseCurrency(values.credit_cost),
    credits_used: values.credits_used,
    credit_batch_id: values.credit_batch_id || null,
    is_reseller: values.is_reseller,
    is_internal: values.is_internal,
    notes: values.notes || null,
  };
}

/** Limite de clientes por importação (protege contra payloads gigantes). */
export const MAX_IMPORT_BATCH = 500;

export const importCustomersSchema = z.object({
  month: monthSchema,
  customerIds: z
    .array(uuidSchema)
    .min(1, "Selecione ao menos 1 cliente")
    .max(MAX_IMPORT_BATCH, `Máximo de ${MAX_IMPORT_BATCH} clientes por vez`),
  mode: z.enum(["auto", ...BILLING_EVENT_TYPES]),
});

export type ImportCustomersInput = z.infer<typeof importCustomersSchema>;

export const panelActiveSchema = z.boolean();
