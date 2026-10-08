# Publicação do site AutoFlow

Sirva somente `web/public/`. No Apache/XAMPP, copie seu conteúdo para `htdocs/AutoFlow/` ou configure essa pasta como raiz pública. Para testes locais, execute na raiz do repositório:

```sh
python -m http.server 8000 --directory web/public
```

As interfaces acessam o Supabase. O painel Python está em `qt/`; não é necessário iniciar um backend Python para servir o site. Os scripts de banco ficam em `web/private/database/` e `supabase/migrations/`, fora da pasta pública. Preserve os arquivos `.htaccess`: eles contêm regras de publicação e proteção do Apache.

## Instalação e banco

Siga os guias atuais, respeitando a ordem das migrações:

- [Verificação de oficinas, Auth, CNPJ e administração](../docs/VERIFICACAO_OFICINAS.md)
- [Cadastro com foto e exclusão de veículos](../docs/CADASTRO_VEICULOS.md)

Não reaplique os scripts SQL antigos depois das migrações mais recentes. A configuração de permissões e RLS faz parte do funcionamento do sistema.

## Login com Google

Autorize no Supabase Auth a URL correspondente ao `callback.html` da instalação, por exemplo `http://localhost/AutoFlow/callback.html` no XAMPP. O código de retorno está em `public/assets/js/callback.js`; a integração principal está em `public/assets/js/integration.js`.

## Chaves

A chave publicável presente no JavaScript identifica o projeto. A proteção dos dados depende da autenticação e das políticas RLS. Chaves secretas ou `service_role` não devem ser colocadas no site, mobile nem no executável Qt. A Edge Function usa suas credenciais no ambiente do servidor, conforme o guia de verificação de oficinas.
