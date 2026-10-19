-- Publica notas/comentários sem divulgar dados de clientes.
-- As oficinas fictícias só podem ser consultadas por seus clientes com O.S., donos e administradores.
create or replace function public.workshop_public_reviews(p_workshop_id bigint)
returns table(id bigint, nota integer, comentario text, created_at timestamptz)
language plpgsql security definer set search_path=''
as $$
begin
 if auth.uid() is null then raise exception 'Faça login para consultar avaliações.' using errcode='42501'; end if;
 if not exists(
   select 1 from public.oficinas o where o.id=p_workshop_id
    and ((o.status='aprovada' and o.verificacao_fonte is distinct from 'AUTOFLOW_DEMO')
       or o.user_id=auth.uid()
       or exists(select 1 from public.autoflow_admins ad where ad.user_id=auth.uid())
       or (o.status='aprovada' and o.verificacao_fonte='AUTOFLOW_DEMO'
         and exists(select 1 from public.ordens_servico os join public.tb_cli c on c.id_cliente=os.cliente_id
           where os.oficina_id=o.id and c.auth_user_id=auth.uid())))
 ) then raise exception 'Oficina não disponível.' using errcode='42501'; end if;
 return query select a.id,a.nota,a.comentario,a.created_at
 from public.avaliacoes a join public.ordens_servico os on os.id=a.os_id
 where os.oficina_id=p_workshop_id order by a.created_at desc limit 100;
end $$;
revoke all on function public.workshop_public_reviews(bigint) from public,anon,authenticated;
grant execute on function public.workshop_public_reviews(bigint) to authenticated;
