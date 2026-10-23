-- Aplicar após conferir e consolidar eventuais placas ativas duplicadas.
-- A migração falha se houver duplicatas; nunca escolhe um proprietário automaticamente.
create unique index autoflow_vehicle_active_plate_unique
  on public.tb_veiculo(upper(regexp_replace(placa,'[ -]','','g')))
  where excluido_em is null;
create index if not exists autoflow_vehicle_client_idx on public.tb_veiculo(cliente_id);
-- O índice único cobre a mesma expressão usada pela busca de placas ativas.
drop index if exists public.autoflow_active_vehicle_plate_idx;

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
  perform pg_advisory_xact_lock(hashtextextended('autoflow:plate:'||plate,0));
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
  if exists(select 1 from public.tb_veiculo where excluido_em is null
    and upper(regexp_replace(placa,'[ -]','','g'))=plate) then
    raise exception 'Esta placa já possui um veículo cadastrado. Solicite ao responsável do AutoFlow a conferência do vínculo; não crie outro cadastro.';
  end if;
  insert into public.tb_veiculo(placa,marca,modelo,ano_do_modelo,km_atual,cliente_id,foto_path)
  values(plate,trim(p_brand),trim(p_model),p_year,p_km,client_id,p_photo)
  returning * into result;
  return to_jsonb(result);
end $$;
