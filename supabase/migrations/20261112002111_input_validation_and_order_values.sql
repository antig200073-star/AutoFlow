-- Valida novas entradas e campos efetivamente alterados. Não reescreve os
-- cadastros antigos nem impede mudanças de status por causa de dados legados.
create function private.validate_autoflow_input()
returns trigger language plpgsql security invoker set search_path='' as $$
declare phone text;
begin
  if tg_table_name='tb_cli' then
    if tg_op='INSERT' or new.nome is distinct from old.nome then
      new.nome:=regexp_replace(btrim(new.nome),'[[:space:]]+',' ','g');
      -- Auth pode usar o e-mail completo como nome provisório da oficina.
      if new.nome is null or length(new.nome) not between 1 and 254 or new.nome ~ '[[:cntrl:]]' then
        raise exception 'Nome inválido ou muito longo.' using errcode='23514';
      end if;
    end if;
    if tg_op='INSERT' or new.email is distinct from old.email then
      new.email:=nullif(lower(btrim(new.email)),'');
      if new.email is not null and (length(new.email)>254 or new.email ~ '[[:cntrl:]]' or new.email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then
        raise exception 'Informe um e-mail válido.' using errcode='23514';
      end if;
    end if;
    if tg_op='INSERT' or new.num_tel is distinct from old.num_tel then
      phone:=nullif(btrim(new.num_tel),'');
      if phone is not null then
        if phone !~ '^[+0-9().[:space:]-]+$' then
          raise exception 'Telefone inválido. Informe o DDD e o número.' using errcode='23514';
        end if;
        phone:=regexp_replace(phone,'[().[:space:]-]','','g');
        if left(phone,3)='+55' then phone:=substr(phone,4);
        elsif phone ~ '^55[0-9]{10,11}$' then phone:=substr(phone,3); end if;
        if phone !~ '^[0-9]{2}([2-57][0-9]{7}|9[0-9]{8})$'
          or not (left(phone,2)=any(array['11','12','13','14','15','16','17','18','19','21','22','24','27','28','31','32','33','34','35','37','38','41','42','43','44','45','46','47','48','49','51','53','54','55','61','62','63','64','65','66','67','68','69','71','73','74','75','77','79','81','82','83','84','85','86','87','88','89','91','92','93','94','95','96','97','98','99'])) then
          raise exception 'Telefone inválido. Use DDD e 8 ou 9 números, como (11) 91234-5678.' using errcode='23514';
        end if;
      end if;
      new.num_tel:=phone;
    end if;
    if tg_op='INSERT' or new.cep is distinct from old.cep then
      new.cep:=nullif(regexp_replace(btrim(new.cep),'[ -]','','g'),'');
      if new.cep is not null and new.cep !~ '^[0-9]{8}$' then
        raise exception 'CEP inválido. Informe os 8 números.' using errcode='23514';
      end if;
    end if;
  elsif tg_table_name='tb_veiculo' then
    if tg_op='INSERT' or new.placa is distinct from old.placa then
      if btrim(new.placa) !~ '^[A-Za-z0-9 -]+$' then
        raise exception 'Informe uma placa válida.' using errcode='23514';
      end if;
      new.placa:=upper(regexp_replace(btrim(new.placa),'[ -]','','g'));
      if new.placa is null or new.placa !~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$' then
        raise exception 'Informe uma placa válida.' using errcode='23514';
      end if;
    end if;
    if tg_op='INSERT' or new.marca is distinct from old.marca then
      new.marca:=nullif(regexp_replace(btrim(new.marca),'[[:space:]]+',' ','g'),'');
      if length(new.marca)>80 then raise exception 'Marca: use até 80 caracteres.' using errcode='23514'; end if;
    end if;
    if tg_op='INSERT' or new.modelo is distinct from old.modelo then
      new.modelo:=nullif(regexp_replace(btrim(new.modelo),'[[:space:]]+',' ','g'),'');
      if length(new.modelo)>150 then raise exception 'Modelo: use até 150 caracteres.' using errcode='23514'; end if;
    end if;
    if tg_op='INSERT' or new.ano_do_modelo is distinct from old.ano_do_modelo then
      if new.ano_do_modelo is not null and (new.ano_do_modelo < 1900 or new.ano_do_modelo > extract(year from current_date)+1 or new.ano_do_modelo<>trunc(new.ano_do_modelo)) then
        raise exception 'Informe um ano inteiro entre 1900 e o próximo ano.' using errcode='23514';
      end if;
    end if;
    if tg_op='INSERT' or new.km_atual is distinct from old.km_atual then
      if new.km_atual is not null and (new.km_atual<0 or new.km_atual>999999999 or new.km_atual<>trunc(new.km_atual)) then
        raise exception 'Informe a quilometragem inteira, de 0 a 999.999.999 km.' using errcode='23514';
      end if;
    end if;
  elsif tg_table_name='avaliacoes' then
    if tg_op='INSERT' or new.comentario is distinct from old.comentario then
      new.comentario:=nullif(btrim(new.comentario),'');
      if length(new.comentario)>2000 then raise exception 'Comentário: use até 2.000 caracteres.' using errcode='23514'; end if;
    end if;
  elsif tg_table_name='ordens_servico' then
    if tg_op='INSERT' or new.descricao_problema is distinct from old.descricao_problema then
      new.descricao_problema:=nullif(btrim(new.descricao_problema),'');
      if length(new.descricao_problema)>4000 then raise exception 'Descrição do problema: use até 4.000 caracteres.' using errcode='23514'; end if;
    end if;
    if tg_op='INSERT' or new.pecas_servicos is distinct from old.pecas_servicos then
      new.pecas_servicos:=nullif(btrim(new.pecas_servicos),'');
      if length(new.pecas_servicos)>4000 then raise exception 'Peças e serviços: use até 4.000 caracteres.' using errcode='23514'; end if;
    end if;
  end if;
  return new;
end $$;
revoke all on function private.validate_autoflow_input() from public,anon,authenticated;

alter table public.ordens_servico
  add column pecas_servicos text,
  add column valor_mao_obra numeric not null default 0,
  add column valor_pecas numeric not null default 0,
  add constraint autoflow_labor_value_check check (valor_mao_obra between 0 and 99999.99 and valor_mao_obra=round(valor_mao_obra,2)),
  add constraint autoflow_parts_value_check check (valor_pecas between 0 and 99999.99 and valor_pecas=round(valor_pecas,2));

create trigger autoflow_validate_client before insert or update of nome,email,num_tel,cep on public.tb_cli
  for each row execute function private.validate_autoflow_input();
create trigger autoflow_validate_vehicle before insert or update of placa,marca,modelo,ano_do_modelo,km_atual on public.tb_veiculo
  for each row execute function private.validate_autoflow_input();
create trigger autoflow_validate_review before insert or update of comentario on public.avaliacoes
  for each row execute function private.validate_autoflow_input();
create trigger autoflow_validate_order before insert or update of descricao_problema,pecas_servicos on public.ordens_servico
  for each row execute function private.validate_autoflow_input();

-- Uma única transação grava a O.S., seus valores e o consumo do código.
-- Os RPCs antigos permanecem disponíveis para instalações anteriores.
create function private.create_workshop_order_validated(p_plate text,p_model text,p_client text,p_problem text,p_status text,p_link_code text,p_services text,p_labor numeric,p_parts numeric)
returns bigint language plpgsql security definer set search_path='' as $$
declare order_id bigint; code text;
begin
  if auth.uid() is null then raise exception 'Autenticação obrigatória.' using errcode='42501'; end if;
  if length(btrim(coalesce(p_model,''))) not between 1 and 150
    or length(btrim(coalesce(p_client,''))) not between 2 and 150
    or length(btrim(coalesce(p_problem,''))) not between 1 and 4000
    or length(coalesce(p_services,''))>4000 then
    raise exception 'Dados da ordem inválidos. Confira cliente, veículo e descrição do problema.' using errcode='23514';
  end if;
  if p_labor is null or p_parts is null or not(p_labor between 0 and 99999.99 and p_parts between 0 and 99999.99)
    or p_labor<>round(p_labor,2) or p_parts<>round(p_parts,2) then
    raise exception 'Valores inválidos. Use de R$ 0,00 a R$ 99.999,99, com até duas casas decimais.' using errcode='23514';
  end if;
  code:=nullif(btrim(p_link_code),'');
  if code is null then
    order_id:=private.create_workshop_order(p_plate,p_model,p_client,p_problem,p_status);
  else
    order_id:=private.create_workshop_order_with_link(p_plate,p_model,p_client,p_problem,p_status,code);
  end if;
  update public.ordens_servico set pecas_servicos=p_services,valor_mao_obra=p_labor,valor_pecas=p_parts where id=order_id;
  return order_id;
end $$;
create function public.create_workshop_order_validated(p_plate text,p_model text,p_client text,p_problem text,p_status text,p_link_code text,p_services text,p_labor numeric,p_parts numeric)
returns bigint language sql security invoker set search_path='' as $$
  select private.create_workshop_order_validated(p_plate,p_model,p_client,p_problem,p_status,p_link_code,p_services,p_labor,p_parts);
$$;
revoke all on function private.create_workshop_order_validated(text,text,text,text,text,text,text,numeric,numeric),public.create_workshop_order_validated(text,text,text,text,text,text,text,numeric,numeric) from public,anon,authenticated;
grant execute on function private.create_workshop_order_validated(text,text,text,text,text,text,text,numeric,numeric),public.create_workshop_order_validated(text,text,text,text,text,text,text,numeric,numeric) to authenticated;

-- Um cadastro por conta. Em atualizações de e-mail, conserva o perfil já
-- editado; metadados antigos não devem substituir os valores atuais.
create or replace function private.handle_new_autoflow_user()
returns trigger language plpgsql security definer set search_path='' as $$
declare client public.tb_cli%rowtype; profile_name text; profile_phone text;
begin
  select * into client from public.tb_cli where auth_user_id=new.id for update;
  profile_name:=coalesce(nullif(btrim(new.raw_user_meta_data->>'nome'),''),
    nullif(btrim(new.raw_user_meta_data->>'full_name'),''),
    nullif(split_part(coalesce(new.email,''),'@',1),''),'Usuário');
  profile_phone:=coalesce(new.raw_user_meta_data->>'telefone',new.raw_user_meta_data->>'phone');
  if found then
    if tg_op='UPDATE' then
      if (new.raw_user_meta_data->>'nome') is not distinct from (old.raw_user_meta_data->>'nome')
        and (new.raw_user_meta_data->>'full_name') is not distinct from (old.raw_user_meta_data->>'full_name') then
        profile_name:=client.nome;
      end if;
      if (new.raw_user_meta_data->>'telefone') is not distinct from (old.raw_user_meta_data->>'telefone')
        and (new.raw_user_meta_data->>'phone') is not distinct from (old.raw_user_meta_data->>'phone') then
        profile_phone:=client.num_tel;
      end if;
    end if;
    update public.tb_cli set nome=profile_name,email=new.email,num_tel=profile_phone where id_cliente=client.id_cliente;
  else
    insert into public.tb_cli(auth_user_id,nome,email,num_tel) values(new.id,profile_name,new.email,profile_phone);
  end if;
  return new;
end $$;
revoke all on function private.handle_new_autoflow_user() from public,anon,authenticated;
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_created_autoflow on auth.users;
create trigger on_auth_user_created_autoflow after insert or update of email,raw_user_meta_data on auth.users
  for each row execute function private.handle_new_autoflow_user();
