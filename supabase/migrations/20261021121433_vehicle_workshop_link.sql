-- O cliente autoriza o primeiro atendimento com um código temporário do próprio veículo.
-- Não associa contas por coincidência de nome/placa e não altera O.S. anteriores.
create table private.vehicle_workshop_links (
  vehicle_id bigint primary key references public.tb_veiculo(id_veiculo),
  client_id bigint not null references public.tb_cli(id_cliente),
  owner_id uuid not null references auth.users(id),
  code uuid not null unique,
  expires_at timestamptz not null,
  used_at timestamptz
);
alter table private.vehicle_workshop_links enable row level security;
revoke all on private.vehicle_workshop_links from public,anon,authenticated;
create index if not exists autoflow_active_vehicle_plate_idx on public.tb_veiculo
  (upper(regexp_replace(placa,'[ -]','','g'))) where excluido_em is null;

create function private.issue_vehicle_workshop_link(p_vehicle_id bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare client_id bigint; token uuid; expiry timestamptz;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta.' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('autoflow:vehicle-link:' || p_vehicle_id::text,0));
  select v.cliente_id into client_id from public.tb_veiculo v join public.tb_cli c on c.id_cliente=v.cliente_id
    where v.id_veiculo=p_vehicle_id and v.excluido_em is null and c.auth_user_id=auth.uid();
  if client_id is null then raise exception 'Veículo não disponível na sua conta.' using errcode='42501'; end if;
  token:=gen_random_uuid(); expiry:=clock_timestamp()+interval '15 minutes';
  insert into private.vehicle_workshop_links(vehicle_id,client_id,owner_id,code,expires_at)
    values(p_vehicle_id,client_id,auth.uid(),token,expiry)
    on conflict(vehicle_id) do update set client_id=excluded.client_id,owner_id=excluded.owner_id,
      code=excluded.code,expires_at=excluded.expires_at,used_at=null;
  return jsonb_build_object('code',token,'expires_at',expiry);
end $$;
create function public.issue_vehicle_workshop_link(p_vehicle_id bigint)
returns jsonb language sql security invoker set search_path='' as $$
  select private.issue_vehicle_workshop_link(p_vehicle_id);
$$;

create function private.create_workshop_order_with_link(p_plate text,p_model text,p_client text,p_problem text,p_status text,p_link_code text)
returns bigint language plpgsql security definer set search_path='' as $$
declare workshop bigint; link private.vehicle_workshop_links; candidate bigint; plate text; order_id bigint;
begin
  select id into workshop from public.oficinas where user_id=auth.uid() and status='aprovada' for share;
  if auth.uid() is null or workshop is null then raise exception 'Oficina sem aprovação ou acesso bloqueado.' using errcode='42501'; end if;
  plate:=upper(regexp_replace(coalesce(p_plate,''),'[ -]','','g'));
  if plate !~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$' or length(trim(coalesce(p_client,''))) not between 2 and 150
    or length(coalesce(p_model,''))>150 or length(coalesce(p_problem,''))>4000
    or p_status is null or p_status not in('aguardando','em_analise','em_manutencao') then raise exception 'Dados da ordem inválidos.'; end if;
  if trim(coalesce(p_link_code,'')) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'Código de vínculo inválido ou expirado. Peça um novo código ao cliente.';
  end if;
  select vehicle_id into candidate from private.vehicle_workshop_links where code=trim(p_link_code)::uuid;
  if candidate is null then raise exception 'Código de vínculo inválido ou expirado. Peça um novo código ao cliente.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('autoflow:vehicle-link:' || candidate::text,0));
  select * into link from private.vehicle_workshop_links where code=trim(p_link_code)::uuid for update;
  if link.vehicle_id is null or link.used_at is not null or link.expires_at<=clock_timestamp() then
    raise exception 'Código de vínculo inválido, expirado ou já utilizado. Confira as O.S. e peça um novo código se necessário.';
  end if;
  -- Revalida posse e placa na utilização; o formulário não pode trocar o proprietário.
  if not exists(select 1 from public.tb_veiculo v join public.tb_cli c on c.id_cliente=v.cliente_id
    where v.id_veiculo=link.vehicle_id and v.cliente_id=link.client_id and c.auth_user_id=link.owner_id
      and v.excluido_em is null and upper(regexp_replace(v.placa,'[ -]','','g'))=plate) then
    raise exception 'O código não corresponde a um veículo ativo com essa placa.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('autoflow:plate:' || plate,0));
  insert into public.ordens_servico(oficina_id,cliente_id,veiculo_id,status,descricao_problema)
    values(workshop,link.client_id,link.vehicle_id,p_status,p_problem) returning id into order_id;
  update private.vehicle_workshop_links set used_at=clock_timestamp() where vehicle_id=link.vehicle_id;
  return order_id;
end $$;
create function public.create_workshop_order_with_link(p_plate text,p_model text,p_client text,p_problem text,p_status text,p_link_code text)
returns bigint language sql security invoker set search_path='' as $$
  select private.create_workshop_order_with_link(p_plate,p_model,p_client,p_problem,p_status,p_link_code);
$$;

-- Preserva atendimentos avulsos, mas impede que uma placa cadastrada em conta ganhe outro cliente sem login.
create or replace function private.create_workshop_order(p_plate text,p_model text,p_client text,p_problem text,p_status text)
returns bigint language plpgsql security definer set search_path='' as $$
declare workshop bigint; client_id bigint; vehicle_id bigint; order_id bigint; plate text; existing_name text; matches integer;
begin
  select id into workshop from public.oficinas where user_id=auth.uid() and status='aprovada' for share;
  if auth.uid() is null or workshop is null then raise exception 'Oficina sem aprovação ou acesso bloqueado.' using errcode='42501'; end if;
  plate:=upper(regexp_replace(coalesce(p_plate,''),'[ -]','','g'));
  if plate !~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$' or length(trim(coalesce(p_client,''))) not between 2 and 150
    or length(coalesce(p_model,''))>150 or length(coalesce(p_problem,''))>4000
    or p_status is null or p_status not in('aguardando','em_analise','em_manutencao') then raise exception 'Dados da ordem inválidos.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('autoflow:plate:' || plate,0));
  select count(*) into matches from public.tb_veiculo v join public.tb_cli c on c.id_cliente=v.cliente_id
    where v.excluido_em is null and upper(regexp_replace(v.placa,'[ -]','','g'))=plate and c.auth_user_id is not null;
  select v.id_veiculo,v.cliente_id,c.nome into vehicle_id,client_id,existing_name
    from public.tb_veiculo v join public.tb_cli c on c.id_cliente=v.cliente_id
    where v.excluido_em is null and upper(regexp_replace(v.placa,'[ -]','','g'))=plate
      and (matches=0 or c.auth_user_id is not null)
      and exists(select 1 from public.ordens_servico os where os.veiculo_id=v.id_veiculo and os.oficina_id=workshop)
    order by v.id_veiculo limit 1;
  if matches>1 or (matches>0 and vehicle_id is null) then
    raise exception 'Peça ao cliente o código em Meus veículos > Vincular à oficina e informe no cadastro da O.S. Não foi criado um cadastro duplicado.';
  end if;
  if vehicle_id is null then
    -- Uma placa avulsa atendida por outra oficina também não pode ser duplicada.
    if exists(select 1 from public.tb_veiculo v where v.excluido_em is null
      and upper(regexp_replace(v.placa,'[ -]','','g'))=plate) then
      raise exception 'Esta placa já possui cadastro sem vínculo com esta oficina. Peça ao responsável do AutoFlow para conferir o vínculo do cliente.';
    end if;
    if exists(select 1 from public.tb_veiculo v join public.tb_cli c on c.id_cliente=v.cliente_id
      where v.excluido_em is not null and c.auth_user_id is not null
        and upper(regexp_replace(v.placa,'[ -]','','g'))=plate) then
      raise exception 'Esta placa foi removida da lista do cliente. Peça ao cliente para cadastrá-la novamente e gerar o código de vínculo.';
    end if;
    insert into public.tb_cli(nome) values(trim(p_client)) returning id_cliente into client_id;
    insert into public.tb_veiculo(placa,modelo,cliente_id) values(plate,trim(p_model),client_id) returning id_veiculo into vehicle_id;
  elsif lower(trim(existing_name))<>lower(trim(p_client)) then
    raise exception 'Esta placa já possui outro cliente nos registros da oficina. Confira o cadastro ou peça o código de vínculo.';
  end if;
  insert into public.ordens_servico(oficina_id,cliente_id,veiculo_id,status,descricao_problema)
    values(workshop,client_id,vehicle_id,p_status,p_problem) returning id into order_id;
  return order_id;
end $$;
revoke all on function private.issue_vehicle_workshop_link(bigint),public.issue_vehicle_workshop_link(bigint),
  private.create_workshop_order_with_link(text,text,text,text,text,text),public.create_workshop_order_with_link(text,text,text,text,text,text)
  from public,anon,authenticated;
grant execute on function private.issue_vehicle_workshop_link(bigint),public.issue_vehicle_workshop_link(bigint),
  private.create_workshop_order_with_link(text,text,text,text,text,text),public.create_workshop_order_with_link(text,text,text,text,text,text)
  to authenticated;
