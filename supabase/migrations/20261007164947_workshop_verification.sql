-- Executar APÓS SUPABASE_SETUP.sql e SECURITY_HARDENING.sql em um banco existente.
-- Preserva os IDs bigint e dados operacionais. Oficinas antigas ficam pendentes.
begin;
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

alter table public.oficinas
  add column user_id uuid unique references auth.users(id) on delete restrict,
  add column status text not null default 'pendente'
    check (status in ('pendente','em_verificacao','aprovada','rejeitada','bloqueada')),
  add column razao_social text,
  add column situacao_cadastral integer,
  add column cnaes jsonb not null default '[]'::jsonb,
  add column verificado_em timestamptz,
  add column verificacao_fonte text,
  add column aprovado_por uuid references auth.users(id) on delete restrict,
  add column aprovado_em timestamptz,
  add column motivo_status text,
  add column revisao integer not null default 0;
alter table public.oficinas alter column estado type varchar(2);
-- Senhas antigas não são migradas para o Auth. É preciso criar/recuperar a conta.
alter table public.oficinas drop column if exists senha;
create index on public.oficinas(status);
-- Impede duplicar um cadastro legado cujo CNPJ foi salvo com pontuação.
create unique index autoflow_cnpj_normalizado on public.oficinas
  (regexp_replace(upper(cnpj), '[^A-Z0-9]', '', 'g'));
create index if not exists autoflow_os_oficina_idx on public.ordens_servico(oficina_id);
create index if not exists autoflow_os_cliente_idx on public.ordens_servico(cliente_id);
create index if not exists autoflow_os_veiculo_idx on public.ordens_servico(veiculo_id);

create table public.autoflow_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table public.oficina_revisoes (
  id bigint generated always as identity primary key,
  oficina_id bigint not null references public.oficinas(id),
  actor_id uuid not null references auth.users(id),
  status_anterior text not null,
  status_novo text not null,
  justificativa text not null,
  vinculo_confirmado boolean not null default false,
  atividade_confirmada boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.oficina_revisoes(oficina_id);
create table public.oficina_consultas (
  user_id uuid primary key references auth.users(id) on delete cascade,
  inicio timestamptz not null default now(), quantidade integer not null default 1
);
alter table public.autoflow_admins enable row level security;
alter table public.oficina_revisoes enable row level security;
alter table public.oficina_consultas enable row level security;
revoke all on public.autoflow_admins, public.oficina_revisoes, public.oficina_consultas from public, anon, authenticated;
grant select on public.autoflow_admins, public.oficina_revisoes to authenticated;
grant all on public.autoflow_admins, public.oficina_revisoes, public.oficina_consultas to service_role;
grant usage on sequence public.oficina_revisoes_id_seq to service_role;
create policy admin_self on public.autoflow_admins for select to authenticated using (user_id = (select auth.uid()));

create function private.is_autoflow_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.autoflow_admins where user_id = auth.uid()
  );
$$;
create function private.owns_active_workshop(p_id bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.oficinas where id = p_id and user_id = auth.uid() and status = 'aprovada'
  );
$$;
create function private.owns_client(p_id bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.tb_cli where id_cliente = p_id and auth_user_id = auth.uid()
  );
$$;
create function private.can_read_client(p_id bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.owns_client(p_id) or exists (
    select 1 from public.ordens_servico os join public.oficinas o on o.id = os.oficina_id
    where os.cliente_id = p_id and o.user_id = auth.uid() and o.status = 'aprovada'
  );
$$;
create function private.can_read_vehicle(p_id bigint, p_client bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.owns_client(p_client) or exists (
    select 1 from public.ordens_servico os join public.oficinas o on o.id = os.oficina_id
    where os.veiculo_id = p_id and o.user_id = auth.uid() and o.status = 'aprovada'
  );
$$;

-- Substitui políticas das tabelas do AutoFlow: permissivas antigas não podem
-- contornar a verificação. Execute por último; não reaplique o setup antigo depois.
do $$ declare p record; begin
  for p in select tablename, policyname from pg_policies where schemaname = 'public'
    and tablename in ('oficinas','ordens_servico','tb_cli','tb_veiculo','avaliacoes')
  loop execute format('drop policy %I on public.%I', p.policyname, p.tablename); end loop;
end $$;
alter table public.oficinas enable row level security;
alter table public.ordens_servico enable row level security;
alter table public.tb_cli enable row level security;
alter table public.tb_veiculo enable row level security;
alter table public.avaliacoes enable row level security;
revoke all on public.oficinas, public.ordens_servico, public.tb_cli, public.tb_veiculo, public.avaliacoes from public, anon, authenticated;
grant select on public.oficinas, public.ordens_servico, public.tb_cli, public.tb_veiculo, public.avaliacoes to authenticated;
grant update (nome, email, num_tel, cep) on public.tb_cli to authenticated;
grant insert, delete on public.tb_veiculo to authenticated;
grant update (placa, marca, modelo, ano_do_modelo, km_atual) on public.tb_veiculo to authenticated;
grant insert on public.avaliacoes to authenticated;
grant usage on sequence public.tb_veiculo_id_veiculo_seq to authenticated;
grant usage on sequence public.avaliacoes_id_seq to authenticated;
grant all on public.oficinas to service_role;
grant usage on sequence public.oficinas_id_seq to service_role;

create policy workshop_read on public.oficinas for select to authenticated
  using (status = 'aprovada' or user_id = (select auth.uid()) or (select private.is_autoflow_admin()));
create policy order_read on public.ordens_servico for select to authenticated
  using (private.owns_client(cliente_id) or private.owns_active_workshop(oficina_id));
create policy client_read on public.tb_cli for select to authenticated using (private.can_read_client(id_cliente));
create policy client_update on public.tb_cli for update to authenticated
  using (auth_user_id = (select auth.uid())) with check (auth_user_id = (select auth.uid()));
create policy vehicle_read on public.tb_veiculo for select to authenticated
  using (private.can_read_vehicle(id_veiculo, cliente_id));
create policy vehicle_insert on public.tb_veiculo for insert to authenticated with check (private.owns_client(cliente_id));
create policy vehicle_update on public.tb_veiculo for update to authenticated
  using (private.owns_client(cliente_id)) with check (private.owns_client(cliente_id));
create policy vehicle_delete on public.tb_veiculo for delete to authenticated using (private.owns_client(cliente_id));
create policy evaluation_read on public.avaliacoes for select to authenticated using (true);
create policy evaluation_insert on public.avaliacoes for insert to authenticated with check (
  exists (select 1 from public.ordens_servico os where os.id = os_id and private.owns_client(os.cliente_id))
);
create policy review_read on public.oficina_revisoes for select to authenticated using ((select private.is_autoflow_admin()));

create function private.review_workshop(p_id bigint, p_revision integer, p_status text,
  p_reason text, p_ownership boolean, p_activity boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare o public.oficinas;
begin
  if not private.is_autoflow_admin() then raise exception 'Acesso restrito à administração.' using errcode = '42501'; end if;
  select * into o from public.oficinas where id = p_id for update;
  if not found or o.revisao <> p_revision then raise exception 'Cadastro alterado. Atualize a lista.'; end if;
  if p_status is null or not (
    (o.status in ('pendente','em_verificacao') and p_status in ('em_verificacao','aprovada','rejeitada','bloqueada')) or
    (o.status = 'aprovada' and p_status in ('em_verificacao','bloqueada')) or
    (o.status = 'rejeitada' and p_status in ('em_verificacao','bloqueada')) or
    (o.status = 'bloqueada' and p_status = 'em_verificacao')
  ) or p_status = o.status then raise exception 'Transição de status inválida.'; end if;
  if p_reason is null or length(trim(p_reason)) < 20 or length(p_reason) > 2000 then
    raise exception 'Registre a justificativa da revisão (20 a 2000 caracteres).';
  end if;
  if p_status = 'aprovada' and (p_ownership is distinct from true or p_activity is distinct from true
    or o.user_id is null or o.situacao_cadastral is distinct from 2 or o.verificado_em is null
    or o.verificado_em < now() - interval '30 days') then
    raise exception 'Confirme o vínculo, a atividade e uma consulta recente de CNPJ ativo.';
  end if;
  update public.oficinas set status = p_status, revisao = revisao + 1,
    motivo_status = case when p_status = 'aprovada' then null else 'Entre em contato com a administração para acompanhar a revisão.' end,
    aprovado_por = case when p_status = 'aprovada' then auth.uid() else null end,
    aprovado_em = case when p_status = 'aprovada' then now() else null end
  where id = p_id;
  insert into public.oficina_revisoes(oficina_id, actor_id, status_anterior, status_novo, justificativa, vinculo_confirmado, atividade_confirmada)
  values (p_id, auth.uid(), o.status, p_status, trim(p_reason), p_ownership, p_activity);
end $$;
create function public.review_workshop(p_id bigint, p_revision integer, p_status text,
  p_reason text, p_ownership boolean default false, p_activity boolean default false) returns void
language sql security invoker set search_path = '' as $$
  select private.review_workshop(p_id, p_revision, p_status, p_reason, p_ownership, p_activity);
$$;

-- Reconsulta é exclusivamente backend. O JWT do administrador é validado na Edge Function.
create function public.refresh_workshop_verification(p_id bigint, p_actor uuid, p_revision integer, p_company jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare o public.oficinas; next_status text;
begin
  if not exists(select 1 from public.autoflow_admins where user_id = p_actor) then raise exception 'Administrador inválido.'; end if;
  select * into o from public.oficinas where id = p_id for update;
  if not found or o.revisao <> p_revision then raise exception 'Cadastro alterado.'; end if;
  if p_company->>'cnpj' is distinct from regexp_replace(upper(o.cnpj), '[^A-Z0-9]', '', 'g') then raise exception 'CNPJ divergente.'; end if;
  next_status := case when o.status = 'aprovada' then 'em_verificacao' else o.status end;
  update public.oficinas set razao_social = p_company->>'razao_social',
    nome = coalesce(p_company->>'nome', nome), telefone = coalesce(p_company->>'telefone', telefone),
    cep = coalesce(p_company->>'cep', cep), logradouro = coalesce(p_company->>'logradouro', logradouro),
    numero = coalesce(p_company->>'numero', numero), bairro = coalesce(p_company->>'bairro', bairro),
    cidade = coalesce(p_company->>'cidade', cidade), estado = coalesce(p_company->>'estado', estado),
    situacao_cadastral = (p_company->>'situacao_cadastral')::integer, cnaes = p_company->'cnaes',
    verificado_em = now(), verificacao_fonte = 'BrasilAPI', status = next_status,
    aprovado_por = null, aprovado_em = null, revisao = revisao + 1
  where id = p_id;
  insert into public.oficina_revisoes(oficina_id, actor_id, status_anterior, status_novo, justificativa)
  values(p_id, p_actor, o.status, next_status, 'Consulta de CNPJ atualizada pela BrasilAPI; requer nova revisão para aprovação.');
end $$;

create function public.consume_workshop_lookup(p_user uuid) returns boolean
language sql security invoker set search_path = '' as $$
  insert into public.oficina_consultas(user_id) values (p_user)
  on conflict(user_id) do update set
    quantidade = case when public.oficina_consultas.inicio < now() - interval '1 hour' then 1 else public.oficina_consultas.quantidade + 1 end,
    inicio = case when public.oficina_consultas.inicio < now() - interval '1 hour' then now() else public.oficina_consultas.inicio end
  returning quantidade <= 10;
$$;

-- Criação atômica de OS: não concede gravação geral nas tabelas à aplicação Qt.
-- Reutiliza veículo somente quando já atendido por ESTA oficina. Não procura
-- clientes globais por nome nem transfere veículos de outra oficina.
create function private.create_workshop_order(p_plate text, p_model text, p_client text, p_problem text, p_status text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare workshop bigint; client_id bigint; vehicle_id bigint; order_id bigint; plate text; existing_name text;
begin
  select id into workshop from public.oficinas where user_id = auth.uid() and status = 'aprovada' for share;
  if auth.uid() is null or workshop is null then raise exception 'Oficina sem aprovação ou acesso bloqueado.' using errcode = '42501'; end if;
  plate := upper(regexp_replace(coalesce(p_plate,''), '[ -]', '', 'g'));
  if plate !~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$' or length(trim(coalesce(p_client,''))) not between 2 and 150
    or length(coalesce(p_model,'')) > 150 or length(coalesce(p_problem,'')) > 4000
    or p_status is null or p_status not in ('aguardando','em_analise','em_manutencao') then raise exception 'Dados da ordem inválidos.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(workshop::text || ':' || plate, 0));
  select v.id_veiculo, v.cliente_id, c.nome into vehicle_id, client_id, existing_name
  from public.tb_veiculo v join public.tb_cli c on c.id_cliente = v.cliente_id
  where upper(regexp_replace(v.placa, '[ -]', '', 'g')) = plate
    and exists(select 1 from public.ordens_servico os where os.veiculo_id = v.id_veiculo and os.oficina_id = workshop)
  order by v.id_veiculo limit 1;
  if vehicle_id is null then
    insert into public.tb_cli(nome) values(trim(p_client)) returning id_cliente into client_id;
    insert into public.tb_veiculo(placa, modelo, cliente_id) values(plate, trim(p_model), client_id) returning id_veiculo into vehicle_id;
  elsif lower(trim(existing_name)) <> lower(trim(p_client)) then
    raise exception 'Esta placa já possui outro cliente nos registros da oficina. Confira o cadastro.';
  end if;
  insert into public.ordens_servico(oficina_id,cliente_id,veiculo_id,status,descricao_problema)
  values(workshop,client_id,vehicle_id,p_status,p_problem) returning id into order_id;
  return order_id;
end $$;
create function public.create_workshop_order(p_plate text, p_model text, p_client text, p_problem text, p_status text default 'aguardando')
returns bigint language sql security invoker set search_path = '' as $$
  select private.create_workshop_order(p_plate,p_model,p_client,p_problem,p_status);
$$;

-- Retira EXECUTE implícito de PUBLIC de todas as funções criadas aqui.
revoke all on function private.is_autoflow_admin(), private.owns_active_workshop(bigint), private.owns_client(bigint),
  private.can_read_client(bigint), private.can_read_vehicle(bigint,bigint),
  private.review_workshop(bigint,integer,text,text,boolean,boolean), private.create_workshop_order(text,text,text,text,text)
  from public, anon, authenticated;
grant execute on function private.is_autoflow_admin(), private.owns_active_workshop(bigint), private.owns_client(bigint),
  private.can_read_client(bigint), private.can_read_vehicle(bigint,bigint),
  private.review_workshop(bigint,integer,text,text,boolean,boolean), private.create_workshop_order(text,text,text,text,text)
  to authenticated;
revoke all on function public.review_workshop(bigint,integer,text,text,boolean,boolean),
  public.create_workshop_order(text,text,text,text,text), public.consume_workshop_lookup(uuid),
  public.refresh_workshop_verification(bigint,uuid,integer,jsonb) from public, anon, authenticated;
grant execute on function public.review_workshop(bigint,integer,text,text,boolean,boolean),
  public.create_workshop_order(text,text,text,text,text) to authenticated;
grant execute on function public.consume_workshop_lookup(uuid), public.refresh_workshop_verification(bigint,uuid,integer,jsonb) to service_role;
commit;
