-- ATENÇÃO: script anterior à verificação de oficinas. Execute ANTES da migração
-- supabase/migrations/20261007164947_workshop_verification.sql, nunca depois.
-- AUTOFLOW - endurecimento para a arquitetura atual
-- O site do cliente NÃO cria nem altera ordens de serviço.
-- Execute no SQL Editor do Supabase após o SUPABASE_SETUP.sql.

-- Remove qualquer política anterior que permita ao cliente inserir OS.
DROP POLICY IF EXISTS "autoflow_os_insert" ON public.ordens_servico;
DROP POLICY IF EXISTS "autoflow_os_update" ON public.ordens_servico;
DROP POLICY IF EXISTS "autoflow_os_delete" ON public.ordens_servico;

-- Remove privilégios diretos da role usada pelo navegador.
REVOKE INSERT, UPDATE, DELETE ON public.ordens_servico FROM authenticated;
GRANT SELECT ON public.ordens_servico TO authenticated;

-- Garante que o cliente só LEIA suas próprias OS.
DROP POLICY IF EXISTS "autoflow_os_select" ON public.ordens_servico;
CREATE POLICY "autoflow_os_select"
ON public.ordens_servico
FOR SELECT TO authenticated
USING (
    cliente_id IN (
        SELECT id_cliente
        FROM public.tb_cli
        WHERE auth_user_id = auth.uid()
    )
);

-- Clientes não podem inserir/alterar/excluir oficinas pelo navegador.
REVOKE INSERT, UPDATE, DELETE ON public.oficinas FROM authenticated;
GRANT SELECT ON public.oficinas TO authenticated;

-- Clientes não podem criar perfis de outros usuários diretamente.
REVOKE INSERT, DELETE ON public.tb_cli FROM authenticated;
GRANT SELECT, UPDATE ON public.tb_cli TO authenticated;

-- Senha não deve ser armazenada em public.tb_cli.
-- O Supabase Auth gerencia a senha de forma apropriada.
ALTER TABLE public.tb_cli DROP COLUMN IF EXISTS senha;

-- Verificação rápida das políticas existentes.
SELECT schemaname, tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
