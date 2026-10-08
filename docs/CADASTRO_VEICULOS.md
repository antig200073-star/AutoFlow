# Cadastro de veículos com foto

O site e o mobile usam a mesma janela dentro da página (não uma janela Python/Qt).

1. Abra **Veículos → Cadastrar veículo**.
2. Toque em **Abrir câmera**, permita o acesso e use **Tirar foto**. É possível refazer a foto.
3. Preencha placa, marca, modelo, ano do modelo e quilometragem atual.
4. Toque em **Salvar veículo**. Após a confirmação do Supabase, a janela fecha e o cartão aparece na lista com a foto e os dados. **Atualizar** consulta os registros novamente.

O cliente é identificado pela sessão autenticada; `cliente_id` não é digitado. Não há cadastro simulado/local quando o servidor falha. A janela mantém os dados para tentar novamente. Veículos antigos permanecem na lista, mesmo sem foto.

## Ativar no Supabase

Requer o banco AutoFlow já atualizado com a verificação de oficinas e os vínculos `tb_cli.auth_user_id`.

No **SQL Editor** do mesmo projeto usado pelo site/mobile, execute somente:

`supabase/migrations/20261008173002_vehicle_photos.sql`

A migração adiciona `tb_veiculo.foto_path`, cria o bucket privado `vehicle-photos`, suas políticas e a função `register_vehicle_with_photo`. Não precisa criar o bucket manualmente nem publicar uma Edge Function para este cadastro. Não reexecute o SQL de instalação inicial sobre seu banco atual.

Publique a nova versão do site e gere/publique o mobile (`cd mobile && npm ci && npm run build`). O mobile importa o componente compartilhado em `web/public/assets`, portanto o build deve usar o repositório completo.

## Câmera e armazenamento

- No celular, abra por **HTTPS** e permita a câmera. No computador, `localhost` também funciona, desde que haja webcam. Um endereço HTTP da rede local no celular não permite esse acesso.
- A câmera traseira é preferida quando disponível; o microfone não é solicitado. O fluxo usa captura direta, sem seleção da galeria.
- A imagem é convertida em JPEG com até 1280 px no maior lado, limite de 5 MB no bucket.
- Salva-se o caminho privado, não uma URL pública. URLs assinadas duram uma hora; **Atualizar** renova o acesso.
- Cada cliente acessa suas próprias fotos. Fotos vinculadas não podem ser substituídas/excluídas diretamente pelo cliente. Cancelar tenta remover um upload ainda não vinculado; falhas de conexão podem deixar uploads órfãos para limpeza administrativa posterior.
- Os cadastros internos de veículos usados pelas ordens de serviço do Qt continuam compatíveis; esta mudança de interface atende ao site e ao mobile.

## Verificação

`npm test` valida dados obrigatórios, migração reaplicável, isolamento das fotos, bloqueio de inserção direta sem foto e repetição idempotente em PostgreSQL/PGlite, além dos testes existentes. `cd mobile && npm run build` verifica o build React. O fluxo visual foi exercitado no navegador com câmera e API simuladas; a câmera física e o projeto Supabase real devem ser conferidos após aplicar a migração e publicar.
