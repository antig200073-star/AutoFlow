# Mobile — funcionalidades do cliente alinhadas ao web

A interface React/Vite em `mobile/` usa o mesmo projeto Supabase do site e do painel da oficina. As telas não usam dados demonstrativos nem dependem de `window.AutoFlowIntegration`.

| Área | Comportamento |
| --- | --- |
| Autenticação | Cadastro, login por senha e Google, restauração da sessão e saída. Telas internas dependem da sessão autenticada. |
| Início / Serviços | Contadores reais, um acompanhamento por O.S. ativa, identificação do veículo e placa, atualização a cada 30 segundos com a tela visível. |
| Retirada | O.S. com status `entregue` sai do acompanhamento e permanece no histórico. Uma nova O.S. tem sua própria barra. |
| Veículos | Cadastro com câmera ou seleção de foto, validações, foto privada, listagem e exclusão com confirmação e preservação do histórico. O formulário e o serviço de veículos são compartilhados com o web. |
| Histórico | Botão ao lado de Excluir veículo; lista as O.S. do veículo e do cliente, oficina, status, serviço/defeito e datas de entrada/saída. |
| Oficinas | Somente aprovadas e permitidas pelo banco; busca por nome/endereço, detalhes, notas, média, comentários e datas. Avaliações usam a RPC pública restrita, sem dados pessoais dos autores. |
| Avaliações | Serviços entregues e ainda não avaliados, envio persistido no Supabase, histórico e bloqueio de duplicação. Falha no envio mantém o formulário sem simular sucesso. |
| Perfil | Dados reais, edição de nome/telefone/e-mail. O e-mail confirmado continua visível até confirmação da troca pelo Auth. Falha parcial é informada. |
| Aparência | Identidade vermelho/grafite/cinza, barra inferior, campos claros com texto escuro mesmo em foco/autofill, modais adaptados ao celular. |

A média exibida nas oficinas corresponde às avaliações retornadas pela RPC, que limita a consulta às 100 mais recentes. Falha na consulta de notas não impede a listagem de oficinas.

## Executar

Baixe ou atualize o repositório completo: o mobile importa o componente de veículos de `web/public/assets/`.

```sh
cd mobile
npm ci
npm run dev
```

No PowerShell, se a execução de scripts bloquear `npm`, use `npm.cmd ci` e `npm.cmd run dev`.

```sh
npm run build
npm run lint
npm test
```

O login Google usa o endereço atual do mobile como retorno. Esse endereço precisa estar na lista de redirecionamentos permitidos do Supabase Auth. A câmera precisa de HTTPS ou localhost; a seleção de arquivo também está disponível.

## Verificação

- Testes de serviço: múltiplas O.S., entrega e nova ordem, filtros por proprietário, avaliações elegíveis, rejeição de duplicadas/alheias/não entregues, erros de persistência, consulta pública de notas, troca de e-mail e atualização periódica sem consultas sobrepostas.
- Testes compartilhados: histórico por veículo e cadastro com foto em PostgreSQL local via PGlite.
- Build e lint do mobile.
- Navegação no Chromium com respostas de API simuladas; os testes não cadastram avaliações, veículos ou perfis no banco de produção.
- Estrutura, RLS e disponibilidade das RPCs conferidas por consultas de leitura no Supabase conectado.

O teste completo com contas reais, redirecionamento Google e câmera física depende do dispositivo e ambiente de publicação. Este trabalho sincroniza a área do cliente; abertura e alteração de O.S. continuam no painel da oficina, como no web.
