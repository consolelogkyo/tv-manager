# 📺 TV Manager — Gestão de Assinaturas

Micro-SaaS interno para gerenciar clientes, vencimentos e renovações de assinaturas de TV.
Feito com **Next.js 15 (App Router)**, **TypeScript**, **Tailwind CSS v4**, componentes no estilo **shadcn/ui** e **Supabase**.

## ✨ Funcionalidades

- Login com e-mail/senha (sem cadastro público), rotas protegidas por `middleware.ts`.
- KPIs: clientes ativos, receita mensal estimada, vencendo em 3 dias e vencidos (clicáveis para filtrar).
- Status calculado em tempo de execução (nunca salvo no banco): **Ativo**, **Vencendo** e **Vencido**.
- Busca instantânea por nome, telefone ou MAC + filtro por status.
- WhatsApp em 1 clique com mensagem de lembrete pronta.
- Copiar MAC em 1 clique; máscara automática `XX:XX:XX:XX:XX:XX`.
- **+30 Dias**: renovação rápida (+1 mês sobre o vencimento; se vencido, pergunta se conta a partir de hoje ou mantém o ciclo).
- Cadastro/edição em modal (bottom sheet no celular) e exclusão com confirmação.
- Layout responsivo: tabela no desktop, cards + botão flutuante no celular.

## 🚀 Como rodar

### 1. Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Abra **SQL Editor** e execute todo o conteúdo de [`supabase/schema.sql`](supabase/schema.sql).
3. Em **Authentication → Users → Add user**, crie os 2 administradores (marque *Auto Confirm User*), usando senhas fortes (12+ caracteres).
4. Em **Authentication → Sign In / Providers**, **desative** *Allow new users to sign up*.
5. Libere os 2 usuários na allow-list (no SQL Editor, trocando os e-mails):

   ```sql
   insert into public.admins (user_id)
   select id from auth.users
   where email in ('voce@exemplo.com', 'socio@exemplo.com')
   on conflict (user_id) do nothing;
   ```

### 2. Variáveis de ambiente

```bash
cp .env.example .env.local
# preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY
# (Project Settings → API)
```

### 3. Rodar

```bash
npm install
npm run dev
# http://localhost:3000
```

## 🗂️ Estrutura

```
app/
  actions/auth.ts         # signIn, signOut (Server Actions)
  actions/customers.ts    # getCustomers, createCustomer, updateCustomer, renewCustomer, deleteCustomer
  login/page.tsx          # Tela de login
  page.tsx                # Dashboard (protegido)
components/
  auth/                   # Formulário de login
  customers/              # Tabela/cards, modal, renovar, excluir, copiar MAC, WhatsApp
  dashboard/              # Header, KPIs, container do painel
  ui/                     # Componentes estilo shadcn/ui
lib/
  date.ts                 # Hoje (fuso fixo), status, dias restantes
  format.ts               # Máscaras (MAC, telefone, R$) e link do WhatsApp
  validations.ts          # Schemas zod (cliente + servidor)
utils/supabase/           # Clientes SSR (server, client, middleware)
middleware.ts             # Proteção de rotas + CSP com nonce
supabase/schema.sql       # Tabelas, RLS, allow-list de admins
```

## 🔐 Segurança

- **Autenticação no servidor**: middleware e todas as Server Actions validam a sessão com `supabase.auth.getUser()`.
- **RLS**: `customers` só é acessível a usuários `authenticated` **e** presentes em `public.admins` (fail-closed mesmo se o cadastro público for reativado por engano). O papel `anon` não tem acesso.
- **Validação dupla com zod** (formulário + servidor) e constraints no banco (formato do MAC, tamanhos, valor ≥ 0).
- **Cookies de sessão HttpOnly**, `SameSite=Lax` e `Secure` em produção.
- **CSRF**: Server Actions aceitam apenas POST e o Next.js valida `Origin` × `Host` nativamente.
- **Cabeçalhos**: CSP com nonce por requisição, `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS (produção) e `Cache-Control: no-store`.
- **Rate limit** de login (5 tentativas / 15 min por IP+e-mail) além dos limites nativos do Supabase Auth.
- Mensagens de erro genéricas para o usuário; logs sem dados sensíveis.

Recomendações adicionais (marcadas como `TODO(security)` no código):

- Habilitar **MFA (TOTP)** e **Leaked password protection** no Supabase Auth.
- Usar um rate limiter distribuído (ex.: Upstash Redis) se fizer deploy com múltiplas instâncias.
- Ajustar **Authentication → Sessions** (time-box / inatividade) conforme sua preferência.
