# Chat entre oficina e cliente — AutoFlow

Implementação experimental isolada na branch `feature/chat-oficina-cliente`, sem merge na `main`.

## Banco de dados
A migração `supabase/migrations/20261026171500_chat_oficina_cliente.sql` cria:
- `chat_conversas`: uma conversa por ordem de serviço já existente
- `chat_mensagens`: mensagens de texto de até 2000 caracteres e remetente autenticado
- `chat_leituras`: marcação de leitura por usuário (estrutura pronta para indicadores)

**Importante:** as três tabelas já foram aplicadas diretamente ao projeto Supabase AutoFlow na fase de desenvolvimento. O SQL fica versionado para reprodução em outros ambientes. Para acessar conversa é necessário ser proprietário do cliente vinculado à O.S. ou titular da oficina aprovada; usuários sem O.S. não podem iniciar a conversa.

## Interfaces
- Web: `web/public/chat.html?os=ID`, link no dashboard de manutenção
- Mobile: botão **Conversar com a oficina** em cada cartão de O.S.
- Qt Desktop: botão **Chat com clientes** no painel principal, que abre diálogo com O.S. da oficina

As mensagens usam Supabase Realtime via Postgres Changes no navegador e mobile, com recuperação periódica de 10s. O desktop consulta a cada 5s enquanto o diálogo está aberto. Necessário login válido em cada interface.

## Validações pendentes
- Testar com duas contas reais autenticadas (cliente e oficina aprovada) e com usuário intruso
- Confirmar renderização e envio no navegador, APK e Qt
- Rodar `npm run build --prefix mobile`, testes, lint e teste interativo das janelas Qt
- Notificações fora do aplicativo e envio de anexos não estão implementados
- A atualização de mensagens lidas via `chat_leituras` não tem interface ainda

Não inserir mensagens fictícias no banco de produção.