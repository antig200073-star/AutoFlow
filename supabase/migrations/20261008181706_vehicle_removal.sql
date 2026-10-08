-- Executar após 20261008173002_vehicle_photos.sql.
-- Exclusão da garagem: mantém dados, fotos e vínculos do histórico de serviços.
begin;
alter table public.tb_veiculo add column if not exists excluido_em timestamptz;

create or replace function private.remove_my_vehicle(p_vehicle_id bigint)
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then
    raise exception 'Entre na sua conta para excluir o veículo.' using errcode='42501';
  end if;
  update public.tb_veiculo v set excluido_em=coalesce(v.excluido_em,now())
  where v.id_veiculo=p_vehicle_id and exists (
    select 1 from public.tb_cli c where c.id_cliente=v.cliente_id and c.auth_user_id=auth.uid()
  );
  if not found then
    raise exception 'Veículo não encontrado na sua conta.' using errcode='42501';
  end if;
end $$;
create or replace function public.remove_my_vehicle(p_vehicle_id bigint)
returns void language sql security invoker set search_path='' as $$
  select private.remove_my_vehicle(p_vehicle_id);
$$;
revoke all on function private.remove_my_vehicle(bigint),public.remove_my_vehicle(bigint) from public,anon,authenticated;
grant execute on function private.remove_my_vehicle(bigint),public.remove_my_vehicle(bigint) to authenticated;
-- Clientes usam a exclusão lógica; ninguém perde histórico por DELETE direto.
revoke delete on public.tb_veiculo from public,anon,authenticated;

-- Uma placa removida pode ser cadastrada novamente, preservando o registro antigo.
create or replace function private.register_vehicle_with_photo(
  p_plate text,p_brand text,p_model text,p_year integer,p_km numeric,p_photo text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare client_id bigint; result public.tb_veiculo; plate text;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta para cadastrar o veículo.' using errcode='42501'; end if;
  select id_cliente into client_id from public.tb_cli where auth_user_id=auth.uid();
  if client_id is null then raise exception 'Perfil do cliente não encontrado. Conclua seu cadastro.'; end if;
  plate := upper(regexp_replace(coalesce(p_plate,''),'[ -]','','g'));
  if plate !~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$'
    or length(trim(coalesce(p_brand,''))) not between 1 and 80
    or length(trim(coalesce(p_model,''))) not between 1 and 120
    or p_year is null or p_year not between 1900 and extract(year from current_date)::integer+1
    or p_km is null or p_km < 0 or p_km > 999999999 or p_km <> trunc(p_km)
    or p_photo is null or p_photo !~ ('^'||auth.uid()::text||'/[0-9a-f-]{36}\.jpg$') then
    raise exception 'Confira placa, marca, modelo, ano, quilometragem e foto.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(client_id::text||':'||plate,0));
  -- Uma repetição após queda de conexão retorna o cadastro já salvo.
  select * into result from public.tb_veiculo where foto_path=p_photo and cliente_id=client_id;
  if found then return to_jsonb(result); end if;
  if not exists(select 1 from storage.objects where bucket_id='vehicle-photos' and name=p_photo) then
    raise exception 'Tire e envie a foto antes de salvar o veículo.';
  end if;
  if exists(select 1 from public.tb_veiculo where cliente_id=client_id and excluido_em is null
    and upper(regexp_replace(placa,'[ -]','','g'))=plate) then
    raise exception 'Esta placa já está cadastrada na sua conta.';
  end if;
  insert into public.tb_veiculo(placa,marca,modelo,ano_do_modelo,km_atual,cliente_id,foto_path)
  values(plate,trim(p_brand),trim(p_model),p_year,p_km,client_id,p_photo)
  returning * into result;
  return to_jsonb(result);
end $$;

commit;
