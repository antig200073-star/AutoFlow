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

Instale `PyQt5` e `supabase` em um ambiente virtual Python. O tema visual foi verificado com PyQt5 5.15.11.

```sh
python qt/main.py
```

É possível abrir os arquivos `qt/*.ui` no Qt Designer. A configuração do banco em `qt/database.py` deve corresponder ao ambiente e às políticas de acesso usadas pelo projeto.

## Verificações desta atualização

- `npm ci`, `npm run build` e `npm run lint` do mobile.
- Navegação das cinco abas, seleção ativa e acesso às avaliações no navegador.
- Layout mobile em 360 e 390 px; site em 390 e 1280 px, sem rolagem horizontal nas páginas verificadas.
- Carregamento das cinco janelas `.ui` com PyQt5 em ambiente gráfico virtual.
- Sintaxe dos módulos Python e JavaScript.

## Limites atuais herdados dos projetos originais

Esta atualização trata da identidade visual e da navegação. Não representa uma validação completa do banco ou da autenticação.

- O login mobile original navega diretamente para a tela inicial; o botão Google também navega sem executar OAuth.
- Diversos componentes mobile esperam funções em `window.AutoFlowIntegration`, mas essa integração não é inicializada pelo projeto React. Há telas com dados de exemplo e gravações simuladas. `src/services/api.js` contém apenas parte dos acessos ao banco e não está conectado a todos os componentes.
- A tela Serviços reorganiza o acompanhamento já disponível no dashboard. Não implementa uma nova solicitação de manutenção nem uma listagem completa do histórico.
- O painel Qt original consulta a coluna `senha` da tabela `oficinas` e depende do esquema e das permissões configuradas. Migrar esse fluxo para autenticação apropriada é uma etapa separada.
- Alguns botões do painel Qt e a busca não tinham lógica conectada no original. A atualização visual não adiciona esses módulos.
- Os testes de layout do site desativaram scripts de dados para evitar acesso ao banco. Os testes de navegação mobile também não acessaram serviços de banco. Não houve criação de usuários, ordens de serviço nem alteração de dados reais.

As chaves encontradas no código são do tipo publicável; arquivos `.env`, dependências instaladas e pastas de build não fazem parte do repositório. Permissões e políticas de acesso ao banco precisam ser revisadas antes de uso em produção.
