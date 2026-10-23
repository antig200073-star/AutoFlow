-- Consulta para preencher a O.S. sem criar registros nem consumir o código de vínculo.
-- Nome do cliente só é retornado para atendimento anterior da oficina ou código válido.
create function private.lookup_workshop_vehicle(p_plate text,p_link_code text default null)
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
    if link_token !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      return jsonb_build_object('status','invalid_link');
    end if;
    select v.* into vehicle from public.tb_veiculo v
      join public.tb_cli c on c.id_cliente=v.cliente_id
      join private.vehicle_workshop_links l on l.vehicle_id=v.id_veiculo
      where l.code=link_token::uuid and l.used_at is null and l.expires_at>clock_timestamp()
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

create function public.lookup_workshop_vehicle(p_plate text,p_link_code text default null)
returns jsonb language sql security invoker set search_path='' as $$
  select private.lookup_workshop_vehicle(p_plate,p_link_code);
$$;
revoke all on function private.lookup_workshop_vehicle(text,text),public.lookup_workshop_vehicle(text,text)
  from public,anon,authenticated;
grant execute on function private.lookup_workshop_vehicle(text,text),public.lookup_workshop_vehicle(text,text)
  to authenticated;
