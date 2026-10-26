# AutoFlow Android — preparação e validação

Preparação realizada originalmente na branch `feature/android-apk`, a partir de `main` no commit `22ea622310ba7f6dd95bab44670691783dd41f8f`, e integrada à `main` em 26/10/2026. As alterações de `fix/mobile-order-client-link` também estão incluídas na `main`. Use `main` para baixar a versão consolidada. Esta integração não alterou configurações ou dados do Supabase nem publicou uma nova versão do aplicativo.

## Estrutura real preservada

| Pasta | Implementação e decisão |
| --- | --- |
| `mobile/` | Aplicação existente em React 19.2.8, JavaScript/JSX e Vite. Entrada `index.html` → `src/main.jsx` → `src/App.jsx`. Build em `dist/`. |
| `mobile/src/` | Login, cadastro, início/serviços, veículos, oficinas/detalhes, histórico, avaliações e perfil. Navegação por estado React. `react-router-dom` já estava instalado, mas não é usado pelas telas. Não foi introduzido outro roteador. |
| `mobile/src/services/` | Serviços Supabase e atualização do acompanhamento a cada 30 segundos com a tela visível. |
| `web/public/` | Site HTML/CSS/JavaScript. Componentes e serviços de veículo são importados pelo Mobile, inclusive câmera, seleção de foto e vínculo por código. Todos os arquivos foram preservados. |
| `qt/` | Painel Python/PyQt5 da oficina, preservado integralmente. |
| `supabase/` | Migrações e funções existentes, sem alterações. |
| `tests/` | Testes existentes de serviços, RLS em PGlite e Python, sem alterações. |

A solicitação direta de manutenção pelo cliente não possui um formulário/serviço implementado nesta versão do repositório. A abertura de O.S. e a alteração de status pertencem ao painel da oficina; o Mobile consulta e acompanha as ordens. A conversão preserva essas regras e não afirma ter implementado funcionalidades ausentes. Orçamento e data estimada também não foram acrescentados.

## Configuração Android

| Propriedade | Valor |
| --- | --- |
| Nome | AutoFlow |
| Application ID / namespace | `br.com.autoflow.app` |
| Capacitor Core / Android / CLI | `8.5.3` |
| Arquivos empacotados | `mobile/dist` |
| Origem do WebView | `https://localhost` — arquivos locais no APK |
| Android mínimo | API 24, Android 7.0; WebView atualizado, versão 111 ou superior |
| Compilação / target | API 36 |
| Java | JDK 21 |
| Gradle / Android Gradle Plugin | `8.14.3` / `8.13.0` |
| Versão Android inicial | `versionCode 1`, `versionName 1.0` |
| Permissões do aplicativo | Internet e câmera; câmera opcional, solicitada quando utilizada |
| Retorno Auth | `br.com.autoflow.app://auth/callback` |

Não há `server.url`, live reload, liberação de HTTP ou carregamento remoto da interface no APK. As consultas HTTPS continuam no mesmo projeto Supabase `tohlfwbzmkjlivcpssbe`. Não foi embutida chave administrativa: o cliente usa a mesma chave publicável existente.

## Alterações

- Projeto Android completo em `mobile/android/`, com Gradle Wrapper, Activity, Manifest, recursos e configuração de plugins.
- Ícones comuns/adaptativos e splash gerados pelo `@capacitor/assets` a partir de `mobile/public/logo-autoflow.jpg`, sem redesenhar a marca. Android 12+ usa o formato de abertura com ícone e fundo previsto pelo sistema.
- Sessão nativa persistida por Capacitor Preferences; o navegador mantém o armazenamento original. Preferences usa o sandbox do Android, não criptografia adicional. Backup em nuvem e transferência de dados foram desabilitados para evitar transportar tokens.
- Renovação da sessão ao retornar ao aplicativo; interrupção da câmera quando ele vai para segundo plano.
- Login Google abre o navegador do sistema. O retorno ao aplicativo aceita somente o endereço exato e troca um código PKCE. Tokens recebidos diretamente por URL não são aceitos. Eventos duplicados não trocam o mesmo código duas vezes.
- Confirmação de cadastro e de troca de e-mail apontam para o mesmo retorno no Android. No navegador, o comportamento original foi mantido.
- Voltar fecha primeiro o teclado ou o modal, inclusive os componentes de veículos com Shadow DOM; depois retorna pela navegação. Na tela inicial, minimiza o app, sem encerrar a sessão.
- Áreas seguras para barras/recortes, `adjustResize`, ocultação do menu inferior durante o teclado e aviso de falta de conexão. A interface existente permanece como base.
- Scripts para gerar recursos, sincronizar, abrir o Android Studio e produzir o APK em Windows/Linux/macOS.
- Vite atualizado de `8.2.2` para `8.2.4` por correções de segurança. As versões existentes de React, Supabase e demais ferramentas principais foram preservadas. Lockfile atualizado e versões das ferramentas fixadas.

### Dependências adicionadas

| Dependência | Versão | Uso |
| --- | --- | --- |
| `@capacitor/core`, `@capacitor/android` | 8.5.3 | Ponte nativa e plataforma Android |
| `@capacitor/app` | 8.1.2 | Ciclo de vida, Voltar e deep links |
| `@capacitor/browser` | 8.0.5 | Navegador do OAuth |
| `@capacitor/keyboard` | 8.0.6 | Teclado |
| `@capacitor/preferences` | 8.0.1 | Persistência da sessão |
| `@capacitor/splash-screen` | 8.0.2 | Tela de abertura |
| `@capacitor/cli` | 8.5.3 | Ferramentas de desenvolvimento |
| `@capacitor/assets` | 3.0.5 | Geração de ícones/splash |
| `@playwright/test` | 1.62.1 | Suíte de interface preparada |

`@supabase/supabase-js` permanece em `2.116.0`, agora com versão exata. Overrides de desenvolvimento: `tar 7.5.22`, `sharp 0.35.5`, `uuid 11.1.1`, `source-map-js 1.2.2`. Eles corrigem os avisos da auditoria nas ferramentas de extração e geração de recursos. A criação de um projeto Android temporário, a geração de recursos e a sincronização foram executadas com esses overrides.

### Arquivos

Modificados: `mobile/.gitignore`, `mobile/index.html`, `mobile/package.json`, `mobile/package-lock.json`, `mobile/src/App.jsx`, `mobile/src/Veiculos.jsx`, `mobile/src/identity.css`, `mobile/src/supabase.js`, `mobile/src/services/api.js`, `mobile/src/services/client-service.js` e `README.md`.

Criados: `mobile/capacitor.config.json`, `mobile/android/`, `mobile/src/native/`, `mobile/scripts/`, `mobile/playwright.config.js`, `mobile/tests/`, este guia e o inventário [ANDROID_ARQUIVOS.txt](ANDROID_ARQUIVOS.txt). O inventário discrimina cada arquivo, incluindo os recursos Android.

## Supabase: verificação somente de leitura

- Confirmado o mesmo projeto nas configurações Mobile, Web e Qt.
- As nove tabelas públicas consultadas estão com RLS habilitado. Foram lidas as políticas de clientes, veículos, ordens, oficinas e avaliações, sem alterá-las.
- `/auth/v1/settings` respondeu HTTP 200 com CORS para `https://localhost`; Google está habilitado e confirmação de e-mail é exigida.
- Consultas anônimas sem dados (`limit=0`) a clientes, veículos e ordens retornaram HTTP 401. Isso verifica a restrição anônima; não comprova todos os cenários de autorização autenticada.
- Não foram criados usuários, veículos, avaliações ou tabelas para o teste.

O advisor apontou avisos anteriores em `handle_new_user` (search_path e privilégios), execução autenticada de `workshop_public_reviews`, proteção contra senhas vazadas desabilitada e tabelas com RLS sem políticas. Não foi feita correção automática: parte dos privilégios faz parte das RPCs existentes, e qualquer revisão deve considerar o uso pelo Web e Desktop.

Referências para esses avisos: [search_path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable), [funções públicas](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [funções autenticadas](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [RLS sem políticas](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) e [proteção de senhas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

### Retorno do Google e confirmação de e-mail

No projeto Supabase existente, em **Authentication → URL Configuration → Redirect URLs**, o endereço abaixo precisa estar autorizado:

```text
br.com.autoflow.app://auth/callback
```

Mantenha os endereços Web já cadastrados e o Site URL existente. Não substitua o callback HTTPS do provedor Google pelo esquema Android: o Google continua retornando primeiro ao Supabase. O retorno nativo acima acontece depois. Esta liberação não foi aplicada nem validada na configuração de produção. O PKCE exige abrir a confirmação no mesmo aplicativo/celular que iniciou a operação; caso contrário, confirme o e-mail e entre com a senha.

## Testes e limites de validação

| Verificação | Resultado |
| --- | --- |
| Baseline Mobile antes das mudanças | Build, lint e 16 testes aprovados |
| Mobile após mudanças | Build Vite, sync Capacitor, lint e 22 testes aprovados |
| Android nativo | `assembleDebug lintDebug`: BUILD SUCCESSFUL; APK de depuração gerado |
| Assinatura/empacotamento | `apksigner verify` e `zipalign -c 4` aprovados; nome, ID e SDKs conferidos por `aapt`; arquivos internos iguais ao `dist/` atual |
| Testes novos | Persistência do adaptador, remoção de sessão, retorno PKCE, rejeição de URLs indevidas/tokens, deduplicação/repetição do callback, histórico de navegação e cancelamento de modais |
| Auditoria npm do Mobile | Zero vulnerabilidades após correções, incluindo dependências de desenvolvimento |
| Suíte geral Node, com PGlite local | 56 de 57 aprovados; uma falha já presente no baseline |
| Python / Qt | 17 testes aprovados, com PyQt5 5.15.11 e plataforma offscreen |
| Edge Function | `deno check` aprovado |
| Supabase real | Apenas verificações de configuração, políticas e HTTP descritas acima |
| Interface Chromium | Não validada: o ambiente bloqueou o socket interno do navegador e a política automática rejeitou execução com permissões ampliadas |
| Aparelho/emulador Android | Não executado; inicialização e fluxos reais permanecem pendentes |

A falha preexistente é `tests/registration.test.mjs:79`: a expressão regular contém escape duplicado no teste da identificação `[TESTE]`. Não houve alteração no cadastro demonstrativo nem nos testes originais. O sucesso do build não equivale à aprovação dos fluxos em um celular.

O lint Android do aplicativo concluiu com 0 erros e 39 avisos. Permanecem avisos de recursos gerados (ícones legados quadrados, ausência de variante monocromática, densidades/duplicatas de splash e recursos não utilizados), ordem de elementos no Manifest e versão mais nova do Gradle disponível. O módulo Capacitor também utiliza o baseline de lint fornecido pelo próprio pacote; o resultado não representa ausência absoluta de avisos em todas as dependências.

Durante a preparação, foram resolvidos: ausência de SDK/JDK com instalação temporária de Android SDK e JDK 21; falhas de download do Gradle com distribuição oficial e configuração de proxy apenas no ambiente; intermediários removidos ao reinstalar dependências com uma nova compilação após a instalação; caminho de entrada do gerador de ícones usando caminho relativo; vulnerabilidades npm com as versões listadas acima. Nenhum caminho ou proxy desta máquina foi incluído no projeto.

## APK entregue

Arquivo para download: `AutoFlow-debug.apk`, gerado do projeto desta branch. Arquivo de origem: `mobile/android/app/build/outputs/apk/debug/app-debug.apk`.

SHA-256:

```text
b7866359da73bf9668b9a6c2a494dfa1595abef5c95b46e68c053c438ca658a5
```

É um APK assinado com chave de depuração, sem assinatura de lançamento e sem publicação em loja. A instalação em aparelho não foi executada neste ambiente.

Os testes Playwright preparados em `mobile/tests/browser/` usam respostas simuladas para autenticação, navegação, sessão, veículos/modais, oficinas, histórico, vínculo, Google e páginas Web. A ponte Capacitor também é simulada. Eles não devem ser confundidos com execução real dos plugins Android ou gravação no Supabase.

## Gerar novas versões

Baixe o repositório completo: `mobile/` importa os arquivos compartilhados de `web/` e os testes da pasta raiz.

Pré-requisitos: Node.js 22.12 ou superior, Android Studio 2025.2.1 ou superior, JDK 21 e Android SDK Platform 36. Pelo SDK Manager, instale também Platform Tools e Android SDK Build Tools 35.0.0 (padrão usado pelo Android Gradle Plugin 8.13.0). O Gradle Wrapper baixa a versão correta do Gradle.

```sh
git clone --branch main https://github.com/antig200073-star/AutoFlow.git
cd AutoFlow/mobile
npm ci
npm run android:debug
```

Saída esperada, relativa à raiz do repositório:

```text
mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

Se o Android Studio ainda não configurou o SDK, abra-o primeiro e confira **Settings → Android SDK**. Alternativamente, configure `ANDROID_HOME` para a pasta do SDK e `JAVA_HOME` para o JDK 21. No Windows, instalações padrão costumam usar:

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
```

Para abrir o projeto já sincronizado:

```sh
npm run android:sync
npm run android:open
```

No Android Studio, aguarde o Gradle Sync e use a opção de gerar APK de depuração, ou execute no terminal:

```powershell
cd android
.\gradlew.bat assembleDebug
```

No Linux/macOS: `cd android && ./gradlew assembleDebug`. Sempre execute `npm run android:sync` depois de alterar React, CSS, JavaScript ou dependências; caso contrário, o APK pode conter uma interface antiga.

Para atualizar ícones/splash a partir da logo existente: `npm run android:assets`. Para incrementar versões, altere `versionCode` e `versionName` em `mobile/android/app/build.gradle`.

### Executar verificações localmente

```sh
cd mobile
npm ci
npm test
npm run lint
npm run build
npx playwright install chromium
npm run test:browser
npm run android:sync
cd android
```

Depois execute `./gradlew lintDebug assembleDebug` ou `.\gradlew.bat lintDebug assembleDebug`. O teste Web usa um servidor Node somente local em `127.0.0.1:4174`; não publica o site.

## Instalar no celular

1. Transfira o APK de depuração para um Android compatível.
2. Abra o arquivo pelo gerenciador de arquivos. Quando o Android solicitar, permita instalar aplicativos dessa origem específica e conclua a instalação.
3. Abra **AutoFlow** com conexão à internet e use uma conta existente. Permita câmera apenas quando usar o cadastro com foto.

Por USB, com depuração habilitada e o aparelho autorizado:

```sh
adb install -r mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

Se já existir um AutoFlow com o mesmo identificador e outra assinatura, a atualização será recusada. Gere a atualização com a mesma chave de assinatura; não desinstale sem avaliar a perda da sessão/configuração local. A desinstalação não exclui os cadastros do Supabase.

## Antes de publicar

- Validar em aparelho: abertura, persistência após fechar/reabrir, suspensão/retorno, perda/retorno da rede, teclado, gesto/botão Voltar, recortes, orientação e tamanhos de tela.
- Testar com contas autorizadas: login/senha, confirmação de cadastro/e-mail e Google (início a frio e app aberto), câmera/permissão negada, seleção/upload de foto, vínculo, exclusão/histórico, avaliações e acompanhamento das alterações feitas pela oficina.
- Conferir os testes Playwright e revisar a falha preexistente da suíte geral.
- Revisar os avisos Supabase com autorização antes de alterar políticas ou funções.
- Criar uma chave de assinatura de lançamento, mantê-la fora do Git e configurar release/AAB. O APK entregue é de depuração; não é uma publicação na Play Store.
- Definir versionamento, política de privacidade, ficha da loja e validar os requisitos vigentes da Play Store na data de publicação.

Documentação consultada: [ambiente Capacitor](https://capacitorjs.com/docs/getting-started/environment-setup), [System Bars](https://capacitorjs.com/docs/apis/system-bars), [Preferences](https://capacitorjs.com/docs/apis/preferences), [ícones/splash](https://capacitorjs.com/docs/guides/splash-screens-and-icons) e [deep links Supabase](https://supabase.com/docs/guides/auth/native-mobile-deep-linking).
