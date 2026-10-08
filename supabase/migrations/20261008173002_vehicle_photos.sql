-- Executar após a instalação de verificação de oficinas (ou o SQL completo enviado).
-- Incremental: preserva veículos antigos, que podem continuar sem foto.
begin;
alter table public.tb_veiculo add column if not exists foto_path text;
create unique index if not exists autoflow_vehicle_photo_unique
  on public.tb_veiculo(foto_path) where foto_path is not null;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('vehicle-photos','vehicle-photos',false,5242880,array['image/jpeg'])
on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=array['image/jpeg'];

-- As políticas restritivas mantêm este bucket privado mesmo se outro bucket
-- possuir uma política permissiva ampla. Não mudam o acesso aos outros buckets.
drop policy if exists af_vehicle_photo_scope on storage.objects;
create policy af_vehicle_photo_scope on storage.objects as restrictive for all to anon,authenticated
using (bucket_id <> 'vehicle-photos' or (auth.uid() is not null and split_part(name,'/',1)=auth.uid()::text))
with check (bucket_id <> 'vehicle-photos' or (auth.uid() is not null
  and name ~ ('^'||auth.uid()::text||'/[0-9a-f-]{36}\.jpg$')));
drop policy if exists af_vehicle_photo_read on storage.objects;
create policy af_vehicle_photo_read on storage.objects for select to authenticated
using(bucket_id='vehicle-photos' and split_part(name,'/',1)=(select auth.uid())::text);
drop policy if exists af_vehicle_photo_insert on storage.objects;
create policy af_vehicle_photo_insert on storage.objects for insert to authenticated
with check(bucket_id='vehicle-photos' and split_part(name,'/',1)=(select auth.uid())::text);
drop policy if exists af_vehicle_photo_no_update on storage.objects;
create policy af_vehicle_photo_no_update on storage.objects as restrictive for update to anon,authenticated
using(bucket_id <> 'vehicle-photos') with check(bucket_id <> 'vehicle-photos');
drop policy if exists af_vehicle_photo_cleanup on storage.objects;
create policy af_vehicle_photo_cleanup on storage.objects for delete to authenticated
using(bucket_id='vehicle-photos' and split_part(name,'/',1)=(select auth.uid())::text);
drop policy if exists af_vehicle_photo_keep_linked on storage.objects;
create policy af_vehicle_photo_keep_linked on storage.objects as restrictive for delete to anon,authenticated
using(bucket_id <> 'vehicle-photos' or not exists(
  select 1 from public.tb_veiculo v where v.foto_path=name
));

-- O cadastro do cliente deve passar pela função: ela exige foto já enviada,
-- valida os dados e resolve cliente_id usando a sessão, nunca o formulário.
revoke insert on public.tb_veiculo from public,anon,authenticated;
do $$ declare cols text; begin
  select string_agg(quote_ident(attname),',') into cols from pg_attribute
    where attrelid='public.tb_veiculo'::regclass and attnum>0 and not attisdropped;
  execute format('revoke insert (%s) on public.tb_veiculo from public, anon, authenticated',cols);
end $$;

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
  if exists(select 1 from public.tb_veiculo where cliente_id=client_id
    and upper(regexp_replace(placa,'[ -]','','g'))=plate) then
    raise exception 'Esta placa já está cadastrada na sua conta.';
  end if;
  insert into public.tb_veiculo(placa,marca,modelo,ano_do_modelo,km_atual,cliente_id,foto_path)
  values(plate,trim(p_brand),trim(p_model),p_year,p_km,client_id,p_photo)
  returning * into result;
  return to_jsonb(result);
end $$;
create or replace function public.register_vehicle_with_photo(
  p_plate text,p_brand text,p_model text,p_year integer,p_km numeric,p_photo text
) returns jsonb language sql security invoker set search_path='' as $$
  select private.register_vehicle_with_photo(p_plate,p_brand,p_model,p_year,p_km,p_photo);
$$;
revoke all on function private.register_vehicle_with_photo(text,text,text,integer,numeric,text),
  public.register_vehicle_with_photo(text,text,text,integer,numeric,text) from public,anon,authenticated;
grant execute on function private.register_vehicle_with_photo(text,text,text,integer,numeric,text),
  public.register_vehicle_with_photo(text,text,text,integer,numeric,text) to authenticated;
commit;
