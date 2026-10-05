# Revisão do login e conexão Supabase - V8

## Alterações realizadas

- O botão **Entrar com o Google** foi movido para dentro do cartão/formulário de login.
- Foi adicionado um divisor visual entre login por e-mail/senha e Google.
- O callback OAuth deixou de usar JavaScript inline.
- Foi criado `public/assets/js/callback.js` para compatibilidade com a Content-Security-Policy do `.htaccess`.
- Scripts receberam versão `?v=8` para reduzir problemas de cache durante testes no XAMPP.

## Revisão da conexão

- O navegador usa apenas a chave `sb_publishable_...`, apropriada para frontend.
- Nenhuma `service_role` foi encontrada na pasta pública.
- A sessão usa `persistSession`, `autoRefreshToken` e `detectSessionInUrl`.
- O login por senha usa `signInWithPassword`.
- O Google usa `signInWithOAuth` e retorna para `callback.html` na mesma origem/pasta do site.
- O acesso aos dados continua dependendo das políticas RLS no Supabase; a chave publicável não substitui essas políticas.

## Configuração externa necessária no Supabase

O endereço de callback usado no navegador precisa estar autorizado em Authentication > URL Configuration. Em XAMPP, o endereço será semelhante a:

`http://localhost/NOME_DA_PASTA/callback.html`

O endereço exato depende do nome da pasta colocada dentro de `htdocs`.
