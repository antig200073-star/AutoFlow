-- Somente a oficina aprovada responsável pela O.S. pode mudar seu status.
create or replace function private.update_workshop_order_status(p_order_id bigint,p_status text)
returns void language plpgsql security definer set search_path='' as $$
declare v_old text;
begin
 if auth.uid() is null then raise exception 'Autenticação obrigatória.' using errcode='42501'; end if;
 if p_status not in ('aguardando','em_analise','em_manutencao','pronto','entregue') or p_status is null then raise exception 'Status inválido.'; end if;
 select os.status into v_old
 from public.ordens_servico os join public.oficinas o on o.id=os.oficina_id
 where os.id=p_order_id and o.user_id=auth.uid() and o.status='aprovada'
 for update of os;
 if not found then raise exception 'Ordem não encontrada nesta oficina ou acesso não autorizado.' using errcode='42501'; end if;
 if v_old='entregue' then raise exception 'A ordem já foi entregue e não pode ser alterada.'; end if;
 if p_status='entregue' and v_old<>'pronto' then raise exception 'Marque Pronto para Retirada antes de entregar.'; end if;
 update public.ordens_servico set status=p_status,
  data_saida=case when p_status='entregue' then now() else null end
 where id=p_order_id;
end $$;
create or replace function public.update_workshop_order_status(p_order_id bigint,p_status text)
returns void language sql security invoker set search_path='' as $$
 select private.update_workshop_order_status(p_order_id,p_status);
$$;
revoke all on function private.update_workshop_order_status(bigint,text) from public,anon,authenticated;
grant execute on function private.update_workshop_order_status(bigint,text) to authenticated;
revoke all on function public.update_workshop_order_status(bigint,text) from public,anon,authenticated;
grant execute on function public.update_workshop_order_status(bigint,text) to authenticated;
