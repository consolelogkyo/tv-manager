-- =============================================================================
-- Gestão de Assinaturas TV — Schema Supabase
-- Execute este script inteiro no SQL Editor do Supabase (Database > SQL Editor).
-- O script é idempotente: pode ser executado mais de uma vez sem erro.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Allow-list de administradores
-- -----------------------------------------------------------------------------
-- Defesa em profundidade: mesmo que o cadastro público do Supabase Auth seja
-- habilitado por engano, apenas os usuários listados aqui conseguem ler ou
-- alterar os clientes (fail-closed).
create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

-- Nenhuma policy de escrita para "admins": a tabela só é gerenciada pelo
-- SQL Editor / service role. Usuários autenticados podem apenas ver a si mesmos.
drop policy if exists "admins_select_self" on public.admins;
create policy "admins_select_self"
  on public.admins
  for select
  to authenticated
  using (user_id = auth.uid());

revoke all on public.admins from anon;
revoke insert, update, delete on public.admins from authenticated;

-- Função usada pelas policies. SECURITY DEFINER para não depender das policies
-- da própria tabela "admins"; search_path fixo para evitar sequestro de schema.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins a where a.user_id = auth.uid()
  );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Tabela de clientes
-- -----------------------------------------------------------------------------
create table if not exists public.customers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text,
  mac_address text not null,
  app_name    text,
  plan_value  numeric(10, 2) not null default 0.00,
  expires_at  date not null,
  notes       text,
  created_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint customers_name_len      check (char_length(name) between 1 and 120),
  constraint customers_phone_digits  check (phone is null or phone ~ '^[0-9]{10,13}$'),
  constraint customers_mac_format    check (mac_address ~ '^([0-9A-F]{2}:){5}[0-9A-F]{2}$'),
  constraint customers_app_len       check (app_name is null or char_length(app_name) <= 60),
  constraint customers_plan_positive check (plan_value >= 0),
  constraint customers_notes_len     check (notes is null or char_length(notes) <= 1000)
);

create index if not exists customers_expires_at_idx on public.customers (expires_at);
create index if not exists customers_mac_address_idx on public.customers (mac_address);

-- Atualiza "updated_at" automaticamente em todo UPDATE.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at
  before update on public.customers
  for each row
  execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. Row Level Security
-- -----------------------------------------------------------------------------
alter table public.customers enable row level security;

-- Princípio do menor privilégio: o papel anônimo não tem nenhum acesso.
revoke all on public.customers from anon;
grant select, insert, update, delete on public.customers to authenticated;

drop policy if exists "customers_select_authenticated" on public.customers;
create policy "customers_select_authenticated"
  on public.customers
  for select
  to authenticated
  using (auth.role() = 'authenticated' and public.is_admin());

drop policy if exists "customers_insert_authenticated" on public.customers;
create policy "customers_insert_authenticated"
  on public.customers
  for insert
  to authenticated
  with check (auth.role() = 'authenticated' and public.is_admin());

drop policy if exists "customers_update_authenticated" on public.customers;
create policy "customers_update_authenticated"
  on public.customers
  for update
  to authenticated
  using (auth.role() = 'authenticated' and public.is_admin())
  with check (auth.role() = 'authenticated' and public.is_admin());

drop policy if exists "customers_delete_authenticated" on public.customers;
create policy "customers_delete_authenticated"
  on public.customers
  for delete
  to authenticated
  using (auth.role() = 'authenticated' and public.is_admin());

-- -----------------------------------------------------------------------------
-- 4. Cadastro dos 2 administradores
-- -----------------------------------------------------------------------------
-- Passo a passo:
--   a) Authentication > Users > "Add user" > crie os 2 usuários (e-mail + senha
--      forte, marque "Auto Confirm User").
--   b) Authentication > Sign In / Providers > desative "Allow new users to sign up".
--   c) Troque os e-mails abaixo pelos reais, descomente e execute:
--
-- insert into public.admins (user_id)
-- select id from auth.users
-- where email in ('voce@exemplo.com', 'socio@exemplo.com')
-- on conflict (user_id) do nothing;
