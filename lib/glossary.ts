import { CHURN_GRACE_DAYS, PARTNERS_COUNT, RESELLER_COMMISSION } from "@/lib/business";
import { EXPIRING_WINDOW_DAYS } from "@/lib/date";

/**
 * Glossário do sistema: explicações exibidas pelos ícones (i).
 * Fonte única — o mesmo termo é explicado com as mesmas palavras em todas as telas.
 */
export type GlossaryEntry = {
  title: string;
  body: readonly string[];
  /** Fórmula opcional, exibida em fonte mono. */
  formula?: string;
};

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const GLOSSARY = {
  /* ------------------------------------------------------------ Clientes --- */
  activeCustomers: {
    title: "Clientes ativos",
    body: [
      "Clientes na carteira com vencimento hoje ou no futuro, incluindo os que vencem nos próximos dias.",
      "Cancelados não entram. Clique no card para ver a lista completa.",
    ],
  },
  expiring: {
    title: `Vencendo em ${EXPIRING_WINDOW_DAYS} dias`,
    body: [
      `Clientes cujo vencimento cai entre hoje e os próximos ${EXPIRING_WINDOW_DAYS} dias.`,
      "É o melhor momento para mandar o lembrete pelo WhatsApp. Clique no card para filtrar a lista.",
    ],
  },
  expired: {
    title: "Clientes vencidos",
    body: [
      "O vencimento já passou e ainda não houve renovação.",
      `Depois de ${CHURN_GRACE_DAYS} dias vencido sem renovar, o cliente passa a contar como perdido (churn) no Financeiro.`,
    ],
  },
  houseBalance: {
    title: "Receita / saldo líquido",
    body: [
      `Soma do valor mensal dos clientes ativos, já descontando ${brl(RESELLER_COMMISSION)} de comissão dos clientes de revendedor. Uso interno conta como R$ 0.`,
      "É uma estimativa da carteira atual. Não desconta o custo de créditos (card ao lado) nem despesas extras — o resultado real do mês está no Financeiro.",
    ],
  },
  resellerCommission: {
    title: "Sua comissão",
    body: [`Você recebe ${brl(RESELLER_COMMISSION)} por mês para cada cliente ativo cadastrado por você.`],
    formula: `Clientes ativos × ${brl(RESELLER_COMMISSION)}`,
  },
  creditsCost: {
    title: "Custo de créditos (projeção)",
    body: [
      "Projeção da carteira ativa: cada cliente ativo consome 1 crédito por mês no seu painel (inclusive acessos de uso interno).",
      "Para cada painel, o cálculo usa o custo do próximo lote ativo em estoque (FIFO) ou o custo de referência do painel quando não há lote em estoque.",
      "O custo real consumido em cada mês (com as variações de preço por lote/promoção) está no DRE em Financeiro.",
    ],
    formula: "Σ clientes ativos no painel × custo atual do painel (lote FIFO ou padrão)",
  },
  netValue: {
    title: "Valor líquido",
    body: [
      `Quanto o cliente deixa para a casa por mês: valor do plano menos ${brl(RESELLER_COMMISSION)} de comissão quando é cliente de revendedor.`,
      "Uso interno aparece como R$ 0 — o custo dele vem do crédito do painel.",
    ],
  },
  statusColors: {
    title: "Cores dos clientes",
    body: [
      "A faixa à esquerda de cada cliente indica a situação: verde = ativo, âmbar = vence nos próximos 3 dias (o ponto pisca para lembrar de mandar mensagem), vermelho = vencido, cinza = cancelado.",
      "Clique no nome ou no botão de detalhes para ver todas as informações do cliente.",
    ],
  },
  internalUse: {
    title: "Uso interno / casa",
    body: [
      "Acesso próprio ou da família. Não gera receita (valor R$ 0), mas consome 1 crédito no painel.",
      "Esse custo aparece no card Custo de créditos e no DRE, sem ser descontado duas vezes.",
    ],
  },
  panel: {
    title: "Painel / servidor",
    body: [
      "Onde o acesso do cliente é ativado. Cada painel tem um custo por crédito, e é ele que define quanto o cliente custa por mês.",
      "Os painéis são cadastrados em Financeiro → Painéis.",
    ],
  },
  panelMigration: {
    title: "Troca de painel",
    body: [
      "Mudar o cliente de painel normalmente consome 1 crédito extra no painel novo.",
      "Com a opção marcada, esse valor entra automaticamente como despesa (Troca de Painel) no mês atual.",
    ],
  },
  paymentDate: {
    title: "Data do pagamento",
    body: [
      "Use só quando o cliente paga em um dia diferente do vencimento. O sinal da TV continua seguindo a data de vencimento.",
    ],
  },
  cancelChurn: {
    title: "Cancelar × excluir",
    body: [
      "Cancelar marca o cliente como perdido (churn) e mantém o cadastro e o histórico financeiro. Para reativar, use o botão Renovar.",
      "Excluir apaga o cadastro para sempre — use só para cadastros feitos por engano.",
    ],
  },
  renewalOptions: {
    title: "Opções de renovação",
    body: [
      "Escolha o período (1 mês, 60 dias, 3, 6 ou 12 meses) e a quantidade de telas para preencher o valor sugerido da tabela, ou digite qualquer valor personalizado.",
      "Em “Somar ao vencimento atual”, os dias restantes da assinatura atual são preservados. Você também pode ajustar manualmente a data de vencimento e a data do pagamento.",
    ],
  },
  renewalCredits: {
    title: "Créditos consumidos na renovação",
    body: [
      "Por padrão, até 3 telas gastam 1 crédito por mês (ex.: painel Next — 3 meses com 2 telas = 3 créditos).",
      "Se o painel deste cliente cobrar 1 crédito por tela, ajuste a quantidade ou use o botão “1 crédito por tela”.",
    ],
  },

  /* ---------------------------------------------------------- Financeiro --- */
  monthNumber: {
    title: "Mês 1, Mês 2…",
    body: [
      "Numeração dos meses que têm lançamentos ou despesas, em ordem a partir do primeiro. Ajuda a comparar a evolução do negócio.",
      "Use “Ir para” para abrir qualquer outro mês, por exemplo para lançar o histórico de meses anteriores.",
    ],
  },
  dre: {
    title: "DRE — Demonstrativo do Resultado",
    body: [
      "Relatório contábil que mostra, em cascata, de onde veio o dinheiro do mês e para onde ele foi.",
      "Começa no faturamento bruto, subtrai comissões, custo dos créditos e despesas extras, e termina no lucro líquido.",
      "Os números vêm dos lançamentos do Livro-Razão (assinaturas novas e renovações com este mês de referência) e das despesas extras do mês.",
    ],
  },
  gross: {
    title: "Faturamento bruto",
    body: [
      "Tudo o que entrou no mês: valores das assinaturas novas e das renovações lançadas com este mês de referência.",
      "Acessos de uso interno entram como R$ 0.",
    ],
    formula: "Assinaturas novas + renovações",
  },
  deductions: {
    title: "Total de gastos / deduções",
    body: ["Tudo o que sai do faturamento antes de sobrar o lucro."],
    formula: "Comissões + créditos dos painéis + despesas extras",
  },
  netProfit: {
    title: "Lucro líquido real",
    body: ["O que sobra de fato no mês depois de pagar comissões, créditos e despesas extras."],
    formula: "Faturamento bruto − total de gastos",
  },
  margin: {
    title: "Margem líquida",
    body: ["Quanto de cada real faturado vira lucro. Exemplo: 60% significa que de cada R$ 100 recebidos sobraram R$ 60."],
    formula: "Lucro líquido ÷ faturamento bruto × 100",
  },
  perPartner: {
    title: "Lucro por sócio",
    body: [`Lucro líquido dividido igualmente entre os ${PARTNERS_COUNT} sócios.`],
    formula: `Lucro líquido ÷ ${PARTNERS_COUNT}`,
  },
  commissions: {
    title: "Comissões de revendedores",
    body: [`${brl(RESELLER_COMMISSION)} por assinatura ou renovação de cliente cadastrado pelo revendedor.`],
  },
  creditsByPanel: {
    title: "Custo de créditos por painel",
    body: [
      "Soma o custo real dos créditos consumidos em cada lançamento do mês — seja de um lote promocional, do custo padrão do painel ou de um valor avulso.",
      "Quando o mesmo painel teve créditos de preços diferentes no mês (ex.: lote promocional a R$ 1,00 e lote normal a R$ 6,00), o DRE mostra o custo médio e o detalhamento por faixa de preço.",
    ],
    formula: "Σ custo real dos créditos consumidos no mês",
  },
  creditBatchesFifo: {
    title: "Lotes de crédito & FIFO",
    body: [
      "Permite registrar compras de créditos por valores diferentes no mesmo painel (ex.: pacote promocional de 10 créditos a R$ 1,00 enquanto o preço normal é R$ 6,00).",
      "FIFO (First-In, First-Out = primeiro que entra, primeiro que sai): por padrão, o sistema pré-seleciona o lote ativo mais antigo com saldo disponível, descontando do estoque a cada novo cliente ou renovação.",
      "Quando o revendedor cadastra ou renova um cliente, o banco aplica o FIFO automaticamente.",
    ],
  },
  inventoryVsDre: {
    title: "Estoque × DRE (sem contagem dupla)",
    body: [
      "Registrar a compra de um lote de créditos abastece o seu estoque, mas não entra como despesa imediata no DRE.",
      "O custo só entra no DRE à medida que cada crédito é efetivamente consumido por um cliente (cadastro, renovação ou troca de painel). Isso evita descontar o mesmo crédito duas vezes e mostra a margem real de cada mês.",
    ],
  },
  panelAverageCost: {
    title: "Custo médio por painel",
    body: [
      "No estoque: média ponderada dos créditos ainda disponíveis nos lotes ativos do painel (valor total em estoque ÷ créditos restantes).",
      "No DRE do mês: média real dos créditos consumidos naquele mês quando houve mais de uma faixa de preço no mesmo painel.",
    ],
    formula: "Custo total dos créditos ÷ quantidade de créditos",
  },
  extraExpenses: {
    title: "Despesas extras / custos invisíveis",
    body: [
      "Gastos que não aparecem no cadastro dos clientes: chip de WhatsApp, licenças de app, marketing, infraestrutura, crédito extra de troca de painel etc.",
      "Entram no mês escolhido como mês de referência.",
    ],
  },
  ledger: {
    title: "Movimentações (Livro-Razão)",
    body: [
      "Cada linha é um pagamento registrado. Cadastrar um cliente ou renová-lo (+30 dias) gera o lançamento automaticamente.",
      "Edite ou exclua uma linha só para corrigir um lançamento errado — o cadastro do cliente não muda.",
    ],
    formula: "Líquido = bruto − comissão − crédito",
  },
  importHistory: {
    title: "Lançar / importar histórico",
    body: [
      "Para meses em que o sistema ainda não registrava lançamentos (como o Mês 1).",
      "Entrada manual: um lançamento com valores livres. Sincronizar: cria 1 lançamento para cada cliente que estava ativo no mês e ainda não tem registro, usando os valores do cadastro atual.",
    ],
  },
  syncMode: {
    title: "Tipo dos lançamentos",
    body: [
      "Automático: vira “assinatura nova” se o cliente foi cadastrado no próprio mês; caso contrário, “renovação”.",
      "Você também pode forçar todos para um dos dois tipos.",
    ],
  },
  payingCustomers: {
    title: "Clientes pagantes",
    body: ["Clientes diferentes com pelo menos um lançamento com valor no mês. Uso interno não conta."],
  },

  /* ----------------------------------------------------- Evolução & churn --- */
  evolution: {
    title: "Comparativo mês a mês",
    body: [
      "Cada barra é o faturamento do mês; a parte preenchida é o lucro líquido e o restante foram os gastos.",
      "O mês selecionado fica em destaque. Clique em uma barra ou linha para abrir aquele mês.",
    ],
  },
  growth: {
    title: "Crescimento %",
    body: ["Variação em relação ao mês anterior com dados."],
    formula: "(mês atual − mês anterior) ÷ mês anterior × 100",
  },
  churn: {
    title: "Taxa de churn",
    body: [
      `Percentual de clientes pagantes perdidos no mês. Perdidos = cancelados no mês + vencidos há mais de ${CHURN_GRACE_DAYS} dias sem renovação.`,
      "Base ativa = clientes ativos no mês + perdidos no mês. Acessos de uso interno não entram.",
    ],
    formula: "Perdidos ÷ base ativa × 100",
  },
  retention: {
    title: "Taxa de retenção",
    body: ["Percentual da base que continuou no mês. É o complemento do churn."],
    formula: "100% − churn",
  },
  lostRevenue: {
    title: "Receita perdida (churn em R$)",
    body: [
      `Soma do valor mensal dos clientes perdidos no mês, já sem a comissão de ${brl(RESELLER_COMMISSION)} dos clientes de revenda.`,
      "É quanto deixa de entrar por mês se eles não voltarem.",
    ],
  },
  arpu: {
    title: "Ticket médio (ARPU)",
    body: ["Receita média por cliente pagante no mês (ARPU = average revenue per user)."],
    formula: "Faturamento bruto ÷ clientes pagantes",
  },
  churnList: {
    title: "Clientes em churn / risco",
    body: [
      "Perdidos no mês selecionado (cancelados ou vencidos há mais de 7 dias).",
      `No mês atual também aparecem os vencidos há até ${CHURN_GRACE_DAYS} dias — ainda dá para recuperar. O botão Recuperar abre o WhatsApp com uma mensagem pronta.`,
    ],
  },

  /* ------------------------------------------------- Despesas & painéis --- */
  expenseCategories: {
    title: "Total por categoria",
    body: ["Soma das despesas extras do período, agrupadas por categoria. Clique em uma categoria para filtrar a lista."],
  },
  panelsCreditsInUse: {
    title: "Créditos em uso hoje",
    body: ["Clientes não cancelados e com vencimento em dia, vinculados a algum painel. Cada um consome 1 crédito por mês."],
  },
  panelsEstimatedCost: {
    title: "Custo mensal estimado",
    body: [
      "Projeção com a carteira de hoje. O custo real de cada mês, baseado nos lançamentos, está no DRE.",
    ],
    formula: "Clientes ativos no painel × custo do crédito",
  },
  panelCostChange: {
    title: "Alterar o custo do crédito",
    body: [
      "O novo valor vale para as próximas assinaturas e renovações. Lançamentos já registrados mantêm o custo da época, então o histórico não muda.",
    ],
  },
  eventResult: {
    title: "Resultado do lançamento",
    body: ["Quanto este pagamento deixa para a casa depois da comissão e do crédito consumido."],
    formula: "Bruto − comissão − crédito",
  },

  /* ----------------------------------------------------------- Apps & TVs --- */
  appPriority: {
    title: "Prioridade do app",
    body: [
      "1ª opção: o app recomendado para essa TV. Reserva: use se o primeiro não funcionar. Fim da fila: última alternativa.",
      "Favoritos aparecem primeiro como sugestão no cadastro de clientes.",
    ],
  },
} as const satisfies Record<string, GlossaryEntry>;

export type GlossaryKey = keyof typeof GLOSSARY;
