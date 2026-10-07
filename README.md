# AutoFlow

Sistema do TCC para acompanhamento de manutenção automotiva e gestão de oficinas.
Os projetos foram importados da pasta `AutoFlow_original` do Google Drive e receberam uma identidade visual comum, usando a logo original.

| Pasta | Aplicação | Tecnologias |
| --- | --- | --- |
| `web/` | Área do cliente | HTML, CSS, JavaScript |
| `mobile/` | Interface mobile responsiva | React, Vite |
| `qt/` | Painel da oficina | Python, PyQt5, Qt Designer |

## Identidade visual

Vermelho `#C62828` para ações principais, grafite `#16181D` para navegação e cinza `#F3F4F6` para o fundo. Cards claros e campos com rótulos, foco de teclado visível e cores de status acompanhadas de texto.

- Logo original: `web/public/assets/img/logo-autoflow.jpg`, também presente no mobile e no Qt, sem alteração da imagem.
- Site: `web/public/assets/css/identity.css`, carregado depois do CSS original.
- Mobile: `mobile/src/identity.css`; barra inferior única com Início, Oficinas, Veículos, Serviços e Perfil. O acesso às avaliações fica em Serviços; Sair fica em Perfil.
- Qt: `qt/autoflow.qss`, também incorporado aos arquivos `.ui` para visualização no Designer. As janelas são carregadas por caminho relativo ao script.

## Verificação de oficinas com Supabase

O cadastro da oficina agora usa Supabase Auth, consulta de CNPJ no servidor e aprovação administrativa. Os estados são `pendente`, `em_verificacao`, `aprovada`, `rejeitada` e `bloqueada`. O banco controla o acesso; o usuário não pode alterar a própria aprovação.

A área administrativa fica em `web/public/admin.html`. O site e o mobile listam somente oficinas aprovadas. A identidade visual e a barra inferior do mobile foram mantidas.

**Ativação necessária:** antes de usar esta versão, aplique a migração, publique a Edge Function e autorize a conta administrativa. O envio ao GitHub não realiza essas ações no Supabase. Siga [Verificação de oficinas — instalação e operação](docs/VERIFICACAO_OFICINAS.md), incluindo a migração das oficinas antigas.

## Executar o mobile

```sh
cd mobile
npm ci
npm run dev
```

Para gerar a versão de produção, execute `npm run build`. Para analisar o código, execute `npm run lint`.

## Executar o site

Sirva `web/public/` com um servidor local HTTP. Exemplo para visualizar a interface:

```sh
python -m http.server 8000 --directory web/public
```

O servidor acima não executa o backend Python. A configuração de banco, OAuth e backend continua sendo necessária para validar os fluxos reais.

## Executar o painel Qt

Instale as dependências em um ambiente virtual Python. O tema visual usa PyQt5 5.15.11.

```sh
python -m pip install -r qt/requirements.txt
python main.py
```

Também funciona `python qt/main.py`. Não use `python -m main.py`.

É possível abrir os arquivos `qt/*.ui` no Qt Designer. A configuração do banco em `qt/database.py` deve corresponder ao ambiente e às políticas de acesso usadas pelo projeto.

## Verificação do código

```sh
npm ci
npm test
npm run check:edge
python -m unittest discover -s tests -p "test_*.py"
npm ci --prefix mobile
npm run build --prefix mobile
npm run lint --prefix mobile
```

Os testes de banco executam a estrutura de referência, os scripts anteriores e a nova migração em PostgreSQL local via PGlite. Os testes de autenticação e CNPJ usam respostas simuladas. Não são alterações nem testes no projeto Supabase de produção.

## Limites atuais

- O login/cadastro mobile e a listagem de oficinas usam o Supabase. Outros componentes ainda dependem de integrações parciais e têm exemplos herdados; o aplicativo completo ainda requer trabalho.
- A revisão do vínculo do solicitante é humana. CNPJ ativo e e-mail confirmado, isoladamente, não comprovam representação da oficina.
- A consulta de CNPJ depende da disponibilidade e cobertura da BrasilAPI. Uma falha não libera acesso.
- Oficinas antigas precisam de conta Auth vinculada por um administrador e de revisão. A senha antiga da tabela não é reutilizada.
- A criação de OS é atômica e limitada à oficina aprovada. O vínculo de atendimentos com contas de clientes existentes ainda precisa de um fluxo próprio de comprovação; não é feito por nome ou placa.
- Alguns botões do Qt, a gestão de estoque e os campos de peças/valores da OS ainda não têm implementação completa.

Consulte os detalhes e as regras de migração no [guia de verificação](docs/VERIFICACAO_OFICINAS.md). As chaves presentes nos clientes são publicáveis. Nunca configure uma chave secreta ou `service_role` no navegador, no mobile ou no Qt.
