import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getFinanceData } from "@/app/actions/finance";
import { AppHeader } from "@/components/dashboard/app-header";
import { FinanceDashboard } from "@/components/finance/finance-dashboard";
import { getAuthContext } from "@/lib/auth";
import { formatDateBR, getTodayISO } from "@/lib/date";
import { getCurrentMonth, isValidMonth } from "@/lib/month";
import { isFinanceTab } from "@/lib/types";

export const metadata: Metadata = {
  title: "Financeiro",
  description: "DRE mensal, evolução, churn, despesas extras e custos de crédito por painel.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function FinancePage({ searchParams }: { searchParams: SearchParams }) {
  // Defesa em profundidade: o middleware exige sessão; aqui exigimos o cargo admin.
  // Revendedor (ou qualquer cargo diferente de admin) é mandado para "/".
  const { user, role } = await getAuthContext();
  if (!user) redirect("/login");
  if (role !== "admin") redirect("/");

  const params = await searchParams;
  const today = getTodayISO();
  const monthParam = first(params.month);
  const tabParam = first(params.tab);
  const month = isValidMonth(monthParam) ? monthParam : getCurrentMonth(today);
  const tab = isFinanceTab(tabParam) ? tabParam : "overview";

  const data = await getFinanceData();

  return (
    <>
      <AppHeader email={user.email ?? "admin"} role={role} />
      <main className="mx-auto max-w-7xl animate-enter px-4 pt-6 pb-28 sm:px-6 sm:pt-8 sm:pb-12 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-medium">Financeiro</h1>
          <p className="mt-1 text-sm text-muted-foreground">Hoje é {formatDateBR(today)}</p>
        </div>
        <FinanceDashboard data={data} today={today} initialMonth={month} initialTab={tab} />
      </main>
    </>
  );
}
