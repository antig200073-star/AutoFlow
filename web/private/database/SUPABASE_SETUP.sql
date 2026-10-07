-- ATENÇÃO: script anterior à verificação de oficinas. Execute ANTES da migração
-- supabase/migrations/20261007164947_workshop_verification.sql, nunca depois.
-- =============================================================
-- AUTOFLOW
-- INTEGRAÇÃO DO BANCO EXISTENTE COM SUPABASE AUTH + RLS
-- =============================================================


-- =============================================================
-- 1. CORRIGIR TIPOS DE DADOS
-- =============================================================

-- Placas podem conter letras: ABC1D23
ALTER TABLE public.tb_veiculo
ALTER COLUMN placa TYPE text
USING placa::text;


-- Telefones podem conter +, (), -, espaços e zeros iniciais
ALTER TABLE public.tb_cli
ALTER COLUMN num_tel TYPE text
USING num_tel::text;


-- CEP pode conter zeros iniciais e hífen
ALTER TABLE public.tb_cli
ALTER COLUMN cep TYPE text
USING cep::text;



-- =============================================================
-- 2. GERAÇÃO AUTOMÁTICA DO ID DOS VEÍCULOS
-- =============================================================

-- tb_cli já possui IDENTITY.
-- tb_veiculo NÃO possui, então criamos uma sequence somente para ele.

CREATE SEQUENCE IF NOT EXISTS public.tb_veiculo_id_veiculo_seq;


ALTER TABLE public.tb_veiculo
ALTER COLUMN id_veiculo
SET DEFAULT nextval('public.tb_veiculo_id_veiculo_seq');


-- Faz a sequência continuar depois do maior ID existente.
SELECT setval(
    'public.tb_veiculo_id_veiculo_seq',
    COALESCE(
        (SELECT MAX(id_veiculo) FROM public.tb_veiculo),
        0
    ) + 1,
    false
);



-- =============================================================
-- 3. CONECTAR TB_CLI AO SUPABASE AUTH
-- =============================================================

ALTER TABLE public.tb_cli
ADD COLUMN IF NOT EXISTS auth_user_id uuid;


-- Chave estrangeira para auth.users
DO $$
BEGIN

    IF NOT EXISTS (

        SELECT 1
        FROM pg_constraint
        WHERE conname = 'tb_cli_auth_user_id_fkey'

    ) THEN

        ALTER TABLE public.tb_cli
        ADD CONSTRAINT tb_cli_auth_user_id_fkey
        FOREIGN KEY (auth_user_id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE;

    END IF;

END;
$$;


-- Um usuário do Supabase só pode possuir um cadastro de cliente
CREATE UNIQUE INDEX IF NOT EXISTS idx_tb_cli_auth_user_id
ON public.tb_cli(auth_user_id);



-- =============================================================
-- 4. FUNÇÃO PARA CRIAR CLIENTE AUTOMATICAMENTE
-- =============================================================

CREATE OR REPLACE FUNCTION public.handle_new_autoflow_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$

BEGIN

    INSERT INTO public.tb_cli (

        auth_user_id,
        nome,
        email,
        num_tel

    )

    VALUES (

        NEW.id,

        COALESCE(
            NEW.raw_user_meta_data->>'nome',
            NEW.raw_user_meta_data->>'full_name',
            split_part(COALESCE(NEW.email, ''), '@', 1),
            'Usuário'
        ),

        NEW.email,

        COALESCE(
            NEW.raw_user_meta_data->>'telefone',
            NEW.raw_user_meta_data->>'phone'
        )

    )

    ON CONFLICT (auth_user_id)

    DO UPDATE SET

        nome = COALESCE(
            EXCLUDED.nome,
            public.tb_cli.nome
        ),

        email = COALESCE(
            EXCLUDED.email,
            public.tb_cli.email
        ),

        num_tel = COALESCE(
            EXCLUDED.num_tel,
            public.tb_cli.num_tel
        );

    RETURN NEW;

END;

$$;



-- =============================================================
-- 5. TRIGGER DO SUPABASE AUTH
-- =============================================================

DROP TRIGGER IF EXISTS
on_auth_user_created_autoflow
ON auth.users;


CREATE TRIGGER on_auth_user_created_autoflow

AFTER INSERT OR UPDATE OF email, raw_user_meta_data

ON auth.users

FOR EACH ROW

EXECUTE FUNCTION public.handle_new_autoflow_user();



-- =============================================================
-- 6. ATIVAR ROW LEVEL SECURITY
-- =============================================================

ALTER TABLE public.tb_cli
ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.tb_veiculo
ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.oficinas
ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.ordens_servico
ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.avaliacoes
ENABLE ROW LEVEL SECURITY;



-- =============================================================
-- 7. REMOVER POLÍTICAS ANTIGAS
-- =============================================================

DROP POLICY IF EXISTS "autoflow_cli_select"
ON public.tb_cli;

DROP POLICY IF EXISTS "autoflow_cli_update"
ON public.tb_cli;


DROP POLICY IF EXISTS "autoflow_vehicle_select"
ON public.tb_veiculo;

DROP POLICY IF EXISTS "autoflow_vehicle_insert"
ON public.tb_veiculo;

DROP POLICY IF EXISTS "autoflow_vehicle_update"
ON public.tb_veiculo;

DROP POLICY IF EXISTS "autoflow_vehicle_delete"
ON public.tb_veiculo;


DROP POLICY IF EXISTS "autoflow_workshop_select"
ON public.oficinas;


DROP POLICY IF EXISTS "autoflow_os_select"
ON public.ordens_servico;

DROP POLICY IF EXISTS "autoflow_os_insert"
ON public.ordens_servico;


DROP POLICY IF EXISTS "autoflow_eval_select"
ON public.avaliacoes;

DROP POLICY IF EXISTS "autoflow_eval_insert"
ON public.avaliacoes;



-- =============================================================
-- 8. POLÍTICAS DE CLIENTE
-- =============================================================

-- Cliente só pode visualizar seu próprio perfil

CREATE POLICY "autoflow_cli_select"

ON public.tb_cli

FOR SELECT

TO authenticated

USING (

    auth_user_id = auth.uid()

);



-- Cliente só pode alterar seu próprio perfil

CREATE POLICY "autoflow_cli_update"

ON public.tb_cli

FOR UPDATE

TO authenticated

USING (

    auth_user_id = auth.uid()

)

WITH CHECK (

    auth_user_id = auth.uid()

);



-- =============================================================
-- 9. POLÍTICAS DOS VEÍCULOS
-- =============================================================

-- Visualizar

CREATE POLICY "autoflow_vehicle_select"

ON public.tb_veiculo

FOR SELECT

TO authenticated

USING (

    cliente_id IN (

        SELECT id_cliente

        FROM public.tb_cli

        WHERE auth_user_id = auth.uid()

    )

);



-- Cadastrar

CREATE POLICY "autoflow_vehicle_insert"

ON public.tb_veiculo

FOR INSERT

TO authenticated

WITH CHECK (

    cliente_id IN (

        SELECT id_cliente

        FROM public.tb_cli

        WHERE auth_user_id = auth.uid()

    )

);



-- Atualizar

CREATE POLICY "autoflow_vehicle_update"

ON public.tb_veiculo

FOR UPDATE

TO authenticated

USING (

    cliente_id IN (

        SELECT id_cliente

        FROM public.tb_cli

        WHERE auth_user_id = auth.uid()

    )

)

WITH CHECK (

    cliente_id IN (

        SELECT id_cliente

        FROM public.tb_cli

        WHERE auth_user_id = auth.uid()

    )

);



-- Excluir

CREATE POLICY "autoflow_vehicle_delete"

ON public.tb_veiculo

FOR DELETE

TO authenticated

USING (

    cliente_id IN (

        SELECT id_cliente

        FROM public.tb_cli

        WHERE auth_user_id = auth.uid()

    )

);



-- =============================================================
-- 10. POLÍTICAS DAS OFICINAS
-- =============================================================

-- Usuários autenticados podem visualizar as oficinas

CREATE POLICY "autoflow_workshop_select"

ON public.oficinas

FOR SELECT

TO authenticated

USING (true);



-- =============================================================
-- 11. POLÍTICAS DAS ORDENS DE SERVIÇO
-- =============================================================

-- Cliente só visualiza suas próprias OS

CREATE POLICY "autoflow_os_select"

ON public.ordens_servico

FOR SELECT

TO authenticated

USING (

    cliente_id IN (

        SELECT id_cliente

        FROM public.tb_cli

        WHERE auth_user_id = auth.uid()

    )

);



-- Cliente só cria OS para ele mesmo e para um veículo dele

-- Cadastro/alteração de OS é feito pelo sistema da oficina/Qt, não pelo navegador.

-- =============================================================
-- 12. POLÍTICAS DAS AVALIAÇÕES
-- =============================================================

-- Cliente só visualiza avaliações de suas próprias OS

CREATE POLICY "autoflow_eval_select"

ON public.avaliacoes

FOR SELECT

TO authenticated

USING (

    os_id IN (

        SELECT os.id

        FROM public.ordens_servico os

        JOIN public.tb_cli c

        ON c.id_cliente = os.cliente_id

        WHERE c.auth_user_id = auth.uid()

    )

);



-- Cliente só avalia suas próprias OS

CREATE POLICY "autoflow_eval_insert"

ON public.avaliacoes

FOR INSERT

TO authenticated

WITH CHECK (

    os_id IN (

        SELECT os.id

        FROM public.ordens_servico os

        JOIN public.tb_cli c

        ON c.id_cliente = os.cliente_id

        WHERE c.auth_user_id = auth.uid()

    )

);



-- =============================================================
-- 13. PERMISSÕES
-- =============================================================

GRANT USAGE
ON SCHEMA public
TO authenticated;



-- Cliente

GRANT SELECT, UPDATE
ON public.tb_cli
TO authenticated;



-- Veículos

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.tb_veiculo
TO authenticated;



-- Oficinas

GRANT SELECT
ON public.oficinas
TO authenticated;



-- Ordens de serviço

GRANT SELECT
ON public.ordens_servico
TO authenticated;



-- Avaliações

GRANT SELECT, INSERT
ON public.avaliacoes
TO authenticated;



-- Sequence usada pelos veículos

GRANT USAGE, SELECT
ON SEQUENCE public.tb_veiculo_id_veiculo_seq
TO authenticated;



-- =============================================================
-- 14. RESULTADO
-- =============================================================

SELECT
    'AutoFlow configurado com sucesso!' AS resultado;