-- Códigos novos têm exatamente seis dígitos; texto preserva zeros à esquerda.
-- UUIDs emitidos antes da atualização continuam válidos até expirar/ser usados.
alter table private.vehicle_workshop_links alter column code type text using code::text;
alter table private.vehicle_workshop_links add constraint vehicle_workshop_links_code_format
  check (code ~ '^([0-9]{6}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$');

-- Limita tentativas inclusive quando a RPC falha e sua transação é revertida.
-- Consulta e abertura de O.S. compartilham o mesmo bloqueio por oficina.
-- Requisições simultâneas são recusadas sem consultar nenhum código.
create function private.throttle_vehicle_link_check(p_workshop_id bigint)
returns void language plpgsql security invoker set search_path='' as $$
begin
  if not pg_try_advisory_xact_lock(hashtextextended('autoflow:link-check:' || p_workshop_id::text,0)) then
    raise exception 'Aguarde um instante antes de conferir o código novamente.' using errcode='P0001';
  end if;
  perform pg_sleep(1);
end $$;
revoke all on function private.throttle_vehicle_link_check(bigint) from public,anon,authenticated;

create or replace function private.issue_vehicle_workshop_link(p_vehicle_id bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  client_id bigint; token text; previous_token text; entropy integer; expiry timestamptz;
  attempt integer; violated_constraint text;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta.' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('autoflow:vehicle-link:' || p_vehicle_id::text,0));
  select v.cliente_id into client_id from public.tb_veiculo v join public.tb_cli c on c.id_cliente=v.cliente_id
    where v.id_veiculo=p_vehicle_id and v.excluido_em is null and c.auth_user_id=auth.uid();
  if client_id is null then raise exception 'Veículo não disponível na sua conta.' using errcode='42501'; end if;
  select l.code into previous_token from private.vehicle_workshop_links l where l.vehicle_id=p_vehicle_id;
  for attempt in 1..32 loop
    -- Os primeiros 20 bits do UUID v4 vêm do gerador criptográfico do Postgres.
    -- Rejeitar o excedente evita viés; não usamos random() nem truncamos códigos existentes.
    loop
      entropy := ('x' || left(gen_random_uuid()::text,5))::bit(20)::integer;
      exit when entropy < 1000000;
    end loop;
    token := lpad(entropy::text,6,'0');
    if token = previous_token then continue; end if;
    expiry := clock_timestamp()+interval '15 minutes';
    begin
      insert into private.vehicle_workshop_links(vehicle_id,client_id,owner_id,code,expires_at)
        values(p_vehicle_id,client_id,auth.uid(),token,expiry)
        on conflict(vehicle_id) do update set client_id=excluded.client_id,owner_id=excluded.owner_id,
          code=excluded.code,expires_at=excluded.expires_at,used_at=null;
      return jsonb_build_object('code',token,'expires_at',expiry);
    exception when unique_violation then
      get stacked diagnostics violated_constraint = constraint_name;
      if violated_constraint <> 'vehicle_workshop_links_code_key' then raise; end if;
      -- Outro veículo já tem esse código; a restrição única também protege concorrência.
    end;
  end loop;
  raise exception 'Não foi possível gerar o código. Tente novamente.';
end $$;

create or replace function private.create_workshop_order_with_link(p_plate text,p_model text,p_client text,p_problem text,p_status text,p_link_code text)
returns bigint language plpgsql security definer set search_path='' as $$
declare workshop bigint; link private.vehicle_workshop_links; candidate bigint; plate text; order_id bigint;
begin
  select id into workshop from public.oficinas where user_id=auth.uid() and status='aprovada' for share;
  if auth.uid() is null or workshop is null then raise exception 'Oficina sem aprovação ou acesso bloqueado.' using errcode='42501'; end if;
  plate:=upper(regexp_replace(coalesce(p_plate,''),'[ -]','','g'));
  if plate !~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$' or length(trim(coalesce(p_client,''))) not between 2 and 150
    or length(coalesce(p_model,''))>150 or length(coalesce(p_problem,''))>4000
    or p_status is null or p_status not in('aguardando','em_analise','em_manutencao') then raise exception 'Dados da ordem inválidos.'; end if;
  if trim(coalesce(p_link_code,'')) !~* '^([0-9]{6}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$' then
    raise exception 'Código de vínculo inválido ou expirado. Peça um novo código ao cliente.';
  end if;
  perform private.throttle_vehicle_link_check(workshop);
  select vehicle_id into candidate from private.vehicle_workshop_links where code=lower(trim(p_link_code));
  if candidate is null then raise exception 'Código de vínculo inválido ou expirado. Peça um novo código ao cliente.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('autoflow:vehicle-link:' || candidate::text,0));
  select * into link from private.vehicle_workshop_links where code=lower(trim(p_link_code)) for update;
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

create or replace function private.lookup_workshop_vehicle(p_plate text,p_link_code text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare workshop bigint; plate text; link_token text; vehicle public.tb_veiculo; client_name text;
begin
  select id into workshop from public.oficinas where user_id=auth.uid() and status='aprovada';
  if auth.uid() is null or workshop is null then
    raise exception 'Oficina sem aprovação ou acesso bloqueado.' using errcode='42501';
  end if;
  plate:=upper(regexp_replace(coalesce(p_plate,''),'[ -]','','g'));
  if plate !~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$' then
    raise exception 'Informe uma placa válida.';
  end if;
  link_token:=nullif(trim(coalesce(p_link_code,'')),'');
  if link_token is not null then
    if link_token !~* '^([0-9]{6}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$' then
      return jsonb_build_object('status','invalid_link');
    end if;
    perform private.throttle_vehicle_link_check(workshop);
    select v.* into vehicle from public.tb_veiculo v
      join public.tb_cli c on c.id_cliente=v.cliente_id
      join private.vehicle_workshop_links l on l.vehicle_id=v.id_veiculo
      where l.code=lower(link_token) and l.used_at is null and l.expires_at>clock_timestamp()
        and l.client_id=v.cliente_id and l.owner_id=c.auth_user_id
        and v.excluido_em is null and upper(regexp_replace(v.placa,'[ -]','','g'))=plate;
    if not found then return jsonb_build_object('status','invalid_link'); end if;
  else
    select v.* into vehicle from public.tb_veiculo v
      where v.excluido_em is null and upper(regexp_replace(v.placa,'[ -]','','g'))=plate
        and exists(select 1 from public.ordens_servico os where os.oficina_id=workshop
          and os.veiculo_id=v.id_veiculo and os.cliente_id=v.cliente_id);
    if not found then
      if exists(select 1 from public.tb_veiculo v join public.tb_cli c on c.id_cliente=v.cliente_id
        where v.excluido_em is null and c.auth_user_id is not null
          and upper(regexp_replace(v.placa,'[ -]','','g'))=plate) then
        return jsonb_build_object('status','needs_link');
      elsif exists(select 1 from public.tb_veiculo v where v.excluido_em is null
        and upper(regexp_replace(v.placa,'[ -]','','g'))=plate) then
        return jsonb_build_object('status','needs_review');
      elsif exists(select 1 from public.tb_veiculo v join public.tb_cli c on c.id_cliente=v.cliente_id
        where v.excluido_em is not null and c.auth_user_id is not null
          and upper(regexp_replace(v.placa,'[ -]','','g'))=plate) then
        return jsonb_build_object('status','removed');
      end if;
      return jsonb_build_object('status','not_found');
    end if;
  end if;
  select nome into client_name from public.tb_cli where id_cliente=vehicle.cliente_id;
  return jsonb_build_object('status','found','plate',plate,'brand',vehicle.marca,
    'model',vehicle.modelo,'year',vehicle.ano_do_modelo,'client_name',client_name);
end $$;
