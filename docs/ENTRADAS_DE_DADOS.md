# Entradas de dados — web, mobile e desktop

Revisão de 12/11/2026. Web e mobile compartilham `input-rules.js` e `input-masks.js`. O desktop usa `qt/input_rules.py` e `qt/input_masks.py`. As máscaras ajudam a digitar; a validação é repetida antes das chamadas e no banco nos campos gravados diretamente. Isso confere o formato, não comprova que telefone, nome ou veículo sejam reais.

| Campo | Interface / regra | Valor gravado |
| --- | --- | --- |
| Telefone do cliente | DDD brasileiro, fixo ou celular; `(11) 3456-7890` / `(11) 91234-5678`; aceita colagem com `+55`; opcional | Apenas números, ou `null` |
| Placa | Maiúsculas; `ABC-1234` ou `ABC1D23`; não aceita letras extras, sinais estranhos ou caracteres parecidos de outro alfabeto | `ABC1234` / `ABC1D23` |
| Ano do modelo | Quatro números, de 1900 ao ano seguinte | Número inteiro |
| Quilometragem | Inteiro de 0 a 999.999.999; agrupamento ao sair do campo (`45.000`); rejeita frações e notação científica | Número inteiro (`45000`) |
| CNPJ da oficina | `11.222.333/0001-81`; aceita o novo formato alfanumérico; confere dígitos verificadores antes de criar a conta | Normalizado pela Edge Function |
| Código de vínculo | Seis números, preservando zeros iniciais; consulta aguarda o código completo | Texto; UUIDs legados ainda aceitos |
| E-mail | Remove espaços nas extremidades, normaliza caixa e confere formato e limite de 254 caracteres | E-mail confirmado pelo Auth |
| Nome | Acentos, apóstrofos e hífens preservados; 2–150 caracteres no formulário; espaços normalizados | Texto; o banco também admite nomes provisórios do Auth |
| Marca / modelo | Obrigatórios no cadastro do cliente; até 80 / 120 caracteres. A descrição combinada no desktop admite 150 | Texto |
| Senha | Sem alteração do conteúdo; confirmação no cadastro do cliente; mínimo de 6 caracteres para cliente e 8 no cadastro da oficina | Somente no Supabase Auth |
| Avaliação | Nota inteira de 1 a 5; O.S. pertencente ao cliente, entregue e ainda não avaliada; comentário até 2.000 caracteres | Nota, O.S. e comentário |
| Problema / peças e serviços | Texto simples no desktop, até 4.000 caracteres; problema obrigatório nas novas O.S. | `descricao_problema` / `pecas_servicos` |
| Mão de obra / peças | `R$ 1.234,56`; entre R$ 0,00 e R$ 99.999,99, até duas casas decimais | `valor_mao_obra` / `valor_pecas`, sem símbolos |
| Decisão administrativa | Opções permitidas conforme status; justificativa de 20–2.000 caracteres, além das confirmações exigidas para aprovação | Revisão administrativa |
| Busca | Texto livre com limite de 150 caracteres | Não é gravado |
| Foto do veículo | JPG, PNG ou WebP até 5 MB; decodificada e convertida para JPEG antes do envio | Objeto privado, com validação existente no servidor |

Os endereços e o CEP da oficina vêm da consulta empresarial, sem novos campos de digitação. O CEP do cliente, quando enviado ao banco, aceita oito números e mantém zeros iniciais. Datas de entrada e saída são controladas pelo sistema; status são escolhas restritas às etapas permitidas.

## Salvamento e compatibilidade

- A migração `input_validation_and_order_values` acrescenta validação para novas entradas e campos alterados. Não corrige nem apaga dados antigos em lote. Atualizar o status ou remover um veículo da lista continua possível mesmo se houver outro campo legado fora do formato atual.
- `create_workshop_order_validated` grava a O.S., peças/serviços, valores e consumo do código numa única transação. As interfaces anteriores continuam usando os RPCs existentes. Valores históricos ficam em zero porque não estavam gravados; o sistema não recupera valores que foram digitados e perdidos anteriormente.
- O cadastro Auth passa a ter uma única rotina para criar o cliente vinculado à conta. Trocar o e-mail ou atualizar metadados não relacionados ao perfil preserva o nome e o telefone editados. Duplicatas históricas não são removidas automaticamente.
- Máscaras novas do Android exigem recompilar e instalar o APK. O desktop exige atualizar os arquivos Python; o web usa a publicação da pasta `web`.

## Verificação

`npm test` executa testes de formatos, seleção/cursor, validação antes das chamadas e migrations no PostgreSQL local (PGlite), inclusive autorização e consumo único do código. `python -m unittest discover -s tests -p 'test_*.py'` verifica o desktop; em servidor sem tela, usar `QT_QPA_PLATFORM=offscreen`. No mobile: `npm test`, `npm run lint`, `npm run build` e `npx cap sync android`.

A validação do CNPJ segue a [documentação da Receita Federal](https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/documentos-tecnicos/cnpj). A máscara telefônica contempla os números nacionais e o [nono dígito da Anatel](https://www.gov.br/anatel/pt-br/regulado/numeracao/nono-digito). Os dados de demonstração reservados continuam sujeitos à autorização existente no servidor.
