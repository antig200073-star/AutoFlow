-- Habilita permissão de cadastro fictício sem conceder acesso administrativo.
-- A inclusão de usuários na tabela deve ser feita individualmente pelo administrador,
-- fora da migração. Não inclua e-mails ou UUIDs pessoais neste arquivo.
begin;
create table if not exists public.autoflow_demo_testers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now()
);
alter table public.autoflow_demo_testers enable row level security;
revoke all on table public.autoflow_demo_testers from public, anon, authenticated;
grant select on table public.autoflow_demo_testers to service_role;
comment on table public.autoflow_demo_testers is
  'Permissão restrita para cadastro de oficinas fictícias via Edge Function; não concede papel administrativo.';

-- Mesmo que uma oficina fictícia seja aprovada para demonstrar o Qt,
-- outras contas cliente não a enxergam como oficina real.
drop policy if exists workshop_read on public.oficinas;
create policy workshop_read on public.oficinas for select to authenticated using (
  (status = 'aprovada' and verificacao_fonte is distinct from 'AUTOFLOW_DEMO')
  or user_id = (select auth.uid())
  or (select private.is_autoflow_admin())
);
commit;
