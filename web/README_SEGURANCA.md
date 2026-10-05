# AutoFlow — arquitetura organizada e segura

## O que vai para o Apache/XAMPP
Use **somente a pasta `public/` como conteúdo público**.

Arquivos públicos:
- HTML das telas
- `assets/css/style.css`
- `assets/js/script.js`
- `assets/js/integration.js`

A chave `sb_publishable_...` presente no JavaScript é uma **chave publicável do Supabase**. Ela não é uma senha de servidor. A proteção dos dados depende principalmente das políticas RLS. **Nunca** coloque `service_role`, senha de banco ou segredo administrativo no JavaScript/HTML.

## O que NÃO deve ficar acessível pela web
A pasta `private/` contém backend Qt/Python, documentação e scripts SQL. Há um `.htaccess` que bloqueia o acesso, mas a melhor prática é manter `private/` fora do `htdocs` em produção.

## Banco de dados
Execute `private/database/SECURITY_HARDENING.sql` no SQL Editor do Supabase. Ele:
- retira do usuário web a permissão de criar/alterar/apagar OS;
- mantém somente a leitura das próprias OS;
- impede escrita em oficinas pelo usuário comum;
- remove a coluna `senha` de `tb_cli` se ela ainda existir.

## Qt Designer / sistema da oficina
Não coloque uma chave `service_role` dentro de um executável Qt distribuído. Um usuário pode extrair a chave do programa. Para operações administrativas, prefira:
1. usuário de oficina autenticado + RLS específica para perfil de oficina; ou
2. uma API/Edge Function no servidor, onde o segredo administrativo fica fora do aplicativo.

## XAMPP
Para teste simples, coloque `public/` dentro de `htdocs/AutoFlow/`.
Exemplo: `C:\xampp\htdocs\AutoFlow\index.html`.
Mantenha `private/` fora de `htdocs` quando possível.
