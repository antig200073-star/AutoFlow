# Inventário do Auto_Flow_V6 recebido

## Usados diretamente pelo site
- `index.html`
- `cadastro.html`
- `dashboard.html`
- `veiculos.html`
- `oficinas.html`
- `avaliacoes.html`
- `perfil.html`
- `assets/css/style.css`
- `assets/js/script.js`
- `assets/js/integration.js`

## Necessário para OAuth Google
- `callback.html` — estava ausente na V6 recebida e foi restaurado a partir da versão integrada anterior.

## Não usados pelo navegador / movidos para private
- `assets/python/conexao.py` — não é chamado por nenhum HTML/JS; reservado ao backend/Qt.
- `assets/python/py.env` — não era carregado corretamente por `load_dotenv()` e não deve ficar público. Foi substituído por `.env.example` sem chave real.
- `INTEGRACAO_BANCO.md` — documentação.
- `Bater_ponto.txt` — anotação/documentação.
- `sql_supa.md` — referência de esquema, não é executado pelo site.
- `assets/css/css.md` — cópia/documentação de CSS; redundante com `style.css`, removida do pacote público.
- `assets/img/` — pasta vazia, removida.
- `.vscode/` — configuração de editor; não é necessária para executar o site.

## Problemas encontrados na V6 recebida
- `integration.js` era apenas um esqueleto comentado, portanto não fazia a integração real com Supabase.
- `index.html` continha uma segunda inicialização inline do Supabase e a expressão `const supabase = supabase.createClient(...)`, que pode quebrar por colisão de nome.
- OAuth apontava para `http://localhost:8000/callback`, enquanto o projeto é servido pelo XAMPP.
- telas ainda continham veículos/oficinas/avaliações de demonstração.
- código Python e arquivo de configuração estavam dentro da árvore pública.
