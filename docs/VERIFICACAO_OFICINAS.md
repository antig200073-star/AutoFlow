# Verificação das oficinas — instalação e operação

O repositório implementa o fluxo abaixo. Publicar o código no GitHub não aplica a migração nem publica a Edge Function no projeto Supabase. As etapas de ativação precisam ser executadas no ambiente correto antes de usar esta versão.

## O que muda

1. O responsável cria uma conta no Supabase Auth e confirma o e-mail.
2. No Qt, entra na conta e informa o CNPJ. A Edge Function valida o JWT, consulta a BrasilAPI e exige situação cadastral ativa.
3. Os dados empresariais vêm da consulta; `user_id` e e-mail vêm do Auth. O cadastro sempre começa como `pendente`.
4. Em `admin.html`, um administrador verifica a atividade e o vínculo do solicitante, registra a justificativa e aprova, rejeita ou bloqueia.
5. Somente uma oficina `aprovada` entra no painel e cria ordens. Site e mobile listam somente oficinas aprovadas.

Um e-mail confirmado e um CNPJ ativo não comprovam que o solicitante representa a empresa. Essa confirmação é uma etapa humana obrigatória: use contato empresarial obtido de fonte independente e evidência de representação. Registre na justificativa como a conferência foi feita, sem copiar documentos pessoais. Não há aprovação automática, biometria, upload de documentos ou garantia de eliminação de fraudes.

## 1. Preparar o banco existente

Use primeiro um ambiente de desenvolvimento com cópia da estrutura real. Faça backup antes da ativação. Esta migração é incremental para as tabelas do AutoFlow; não cria um banco vazio do zero.

Ordem dos scripts, caso a integração anterior ainda não tenha sido instalada:

1. `web/private/database/SUPABASE_SETUP.sql`
2. `web/private/database/SECURITY_HARDENING.sql`
3. `supabase/migrations/20261007164947_workshop_verification.sql`

Se os dois primeiros já foram aplicados, execute somente a nova migração, uma vez, no SQL Editor. Não reaplique os scripts antigos depois: eles contêm regras anteriores de acesso. A migração substitui as políticas das cinco tabelas do AutoFlow para que políticas permissivas antigas não contornem a aprovação. Se o banco tiver customizações fora do esquema do repositório, compare-as antes de executar.

A migração mantém o ID `bigint` de cada oficina e os vínculos das ordens. Adiciona `user_id uuid` ligado ao Auth; não converte a chave primária para UUID. Oficinas existentes começam pendentes, sem conta vinculada. A coluna de senha antiga, se existir, é removida; as senhas não são importadas para o Auth.

Antes de executar, identifique CNPJs duplicados que diferem apenas na pontuação:

```sql
select regexp_replace(upper(cnpj), '[^A-Z0-9]', '', 'g') as cnpj_normalizado,
       array_agg(id) as ids
from public.oficinas
group by 1 having count(*) > 1;
```

Resolva duplicidades preservando os vínculos dos registros. O índice novo rejeita duplicatas normalizadas; um conflito interrompe a transação sem aplicar parcialmente a migração.

## 2. Publicar a consulta de CNPJ

Na raiz do repositório:

```sh
npm ci
npx supabase login
npx supabase functions deploy register-workshop --project-ref SEU_PROJECT_REF
```

Confira `supabase/config.toml`: a função usa `verify_jwt = false` para compatibilidade com chaves publicáveis, mas valida explicitamente o token do usuário usando `auth.getUser(token)` em cada chamada. Nunca remova essa validação.

A função usa `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEYS` e `SUPABASE_SECRET_KEYS` do ambiente hospedado. Aceita os nomes legados `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` como alternativa. As chaves modernas são objetos JSON com a propriedade `default`. Uma chave secreta não deve ser colocada no Qt, site, mobile, arquivos versionados ou variáveis com prefixo público.

No Auth do Supabase, mantenha a confirmação de e-mail habilitada e configure o envio de mensagens e os endereços de redirecionamento. O botão Google do mobile também depende da configuração do provedor e da URL de retorno. Use o mesmo projeto e sua chave publicável em `qt/database.py`, `mobile/src/supabase.js`, `web/public/assets/js/integration.js` e `web/public/assets/js/admin.js`. O Qt aceita sobrescrever os valores por `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` no ambiente.

## 3. Autorizar o primeiro administrador

Crie uma conta no Auth, confirme seu e-mail e copie seu UUID no painel do Supabase. No SQL Editor, substitua o exemplo abaixo pelo UUID da conta verificada:

```sql
insert into public.autoflow_admins(user_id)
values ('UUID_REAL_DO_ADMINISTRADOR'::uuid)
on conflict do nothing;
```

Esse comando é administrativo; os aplicativos não têm permissão para executá-lo. Nenhum usuário é administrador por ser o primeiro cadastrado, pelo domínio do e-mail ou por metadados editáveis.

Sirva `web/public` e abra `/admin.html`. A tela permite consultar os cadastros por status, rever os dados, conferir CNAEs, registrar decisões e ler o histórico. A autorização também é verificada no banco; esconder a tela não é a proteção de acesso.

Para retirar a autorização de um administrador, remova sua linha de `public.autoflow_admins` usando o SQL Editor. A próxima operação administrativa consulta essa tabela novamente.

## 4. Migrar oficinas antigas

O responsável precisa criar/recuperar uma conta no Auth e confirmar o e-mail. Não há vínculo automático por e-mail ou CNPJ: isso permitiria assumir um cadastro de outra pessoa.

Após confirmar o vínculo por um canal independente, o responsável pelo banco pode associar a conta à oficina existente:

```sql
-- Substitua os dois valores. Confira o cadastro antes de executar.
update public.oficinas
set user_id = 'UUID_REAL_DO_RESPONSAVEL'::uuid,
    revisao = revisao + 1
where id = ID_REAL_DA_OFICINA and user_id is null;
```

Confira se exatamente uma linha foi alterada. Depois, em `admin.html`, reconsulte o CNPJ, confira os dados e realize a revisão. O vínculo não aprova o cadastro. O ID e as ordens anteriores são preservados.

## Regras de revisão e bloqueio

| Status atual | Próximas decisões permitidas |
| --- | --- |
| Pendente | Em verificação, aprovada, rejeitada ou bloqueada |
| Em verificação | Aprovada, rejeitada ou bloqueada |
| Aprovada | Em verificação ou bloqueada |
| Rejeitada | Em verificação ou bloqueada |
| Bloqueada | Em verificação |

Para aprovar, a oficina precisa ter conta vinculada, CNPJ ativo consultado nos últimos 30 dias e as duas confirmações administrativas. Toda decisão requer justificativa de 20 a 2000 caracteres. O histórico registra autor, data, status anterior e novo. A revisão tem um número de versão para impedir que decisões simultâneas sobrescrevam uma alteração mais recente.

Reconsultar um cadastro aprovado o devolve para `em_verificacao`, suspendendo o acesso até a nova revisão. Uma indisponibilidade do provedor não altera o cadastro. Não há monitoramento periódico automático da Receita depois da aprovação; a reconsulta é iniciada pelo administrador. A janela de 30 dias é exigida no momento de aprovar, não um vencimento automático da aprovação.

As políticas de RLS e a função de criação de ordens verificam o status atual no banco. Bloquear uma oficina impede novas operações mesmo com uma sessão já aberta. O Qt confere novamente antes das operações e, enquanto o painel está aberto, a cada 60 segundos. Dados já carregados na tela não podem ser apagados retroativamente do dispositivo; o histórico do próprio cliente continua acessível a ele.

## CNPJ e disponibilidade

O validador aceita CNPJ numérico e alfanumérico, conforme o cálculo de dígitos da Receita Federal. A consulta usa a BrasilAPI; se ela não atender um CNPJ, estiver indisponível, retornar erro, dados incompletos ou um CNPJ diferente, o cadastro não é concluído. Não existe uma alternativa que aprove sem consulta. Cada conta pode fazer até 10 tentativas de consulta por hora. O limite é controlado no banco, não apenas na interface.

São guardados dados empresariais, CNAEs, situação cadastral, fonte e data da consulta. A função descarta o quadro de sócios e não usa o e-mail retornado pelo provedor como identidade do solicitante.

Fontes técnicas: [RLS do Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security), [autenticação nas Edge Functions](https://supabase.com/docs/guides/functions/auth), [BrasilAPI](https://brasilapi.com.br/docs#tag/CNPJ), [manual de cálculo do CNPJ alfanumérico](https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/documentos-tecnicos/cnpj/manual-dv-cnpj.pdf).

## Executar e verificar

```sh
python -m pip install -r qt/requirements.txt
python main.py
```

Também funciona `python qt/main.py`. Não use `python -m main.py`. Os arquivos `.ui` continuam editáveis no Qt Designer.

```sh
npm ci
npm test
npm run check:edge
python -m unittest discover -s tests -p "test_*.py"
npm ci --prefix mobile
npm run build --prefix mobile
npm run lint --prefix mobile
```

Os testes usam PostgreSQL local via PGlite e mocks de Auth/provedor. Cobrem rejeição de acesso anônimo, impedimento de autoaprovação, controle de administrador, CNPJ, concorrência de revisão, isolamento das oficinas, bloqueio com a mesma identidade, histórico e limite de consultas. Não acessam o banco de produção, não enviam e-mails e não provam a configuração do ambiente hospedado. Antes de liberar o ambiente real, repita o fluxo com contas de teste: cadastro, confirmação, pendência, revisão, aprovação e bloqueio.

## Limitações dos módulos existentes

A criação de OS foi transferida para uma operação atômica no banco. Ela reutiliza um veículo somente se já houver ordem dessa oficina para ele; não busca clientes globais pelo nome. Quando não há vínculo anterior, cria registros de atendimento separados. Vincular esses registros a uma conta de cliente existente requer um fluxo futuro com comprovação de titularidade; esta atualização não faz associação automática por nome ou placa. Campos de peças e valores da tela original ainda não são persistidos, pois o esquema atual não possui essas colunas.

O login, cadastro e a listagem de oficinas do mobile agora usam o Supabase. Outros componentes ainda contêm integrações parciais ou exemplos herdados; não se deve tratar o aplicativo inteiro como finalizado. A gestão completa de estoque, edição de OS e alguns botões do Qt permanecem fora desta entrega.
