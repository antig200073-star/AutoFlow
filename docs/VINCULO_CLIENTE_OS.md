# Vínculo entre cliente, veículo e O.S.

Uma O.S. só aparece no web/mobile quando `ordens_servico.cliente_id` aponta para o perfil associado ao login do cliente. O cadastro avulso da oficina tem nome, mas não tem `auth_user_id`; por isso, copiar nome e placa não vincula a conta.

## Primeiro atendimento de um veículo já cadastrado

1. No web ou mobile, o cliente abre **Meus veículos → Vincular à oficina → Gerar código**.
2. Entrega o código somente à oficina escolhida. O código expira em 15 minutos, vale uma vez e é invalidado se outro for gerado.
3. A oficina preenche a placa e o código no cadastro da O.S. do desktop.
4. O banco usa os IDs do veículo e do proprietário autorizados pelo código. Não cria outra conta nem outro veículo.
5. O acompanhamento aparece na conta do cliente. A oficina pode reutilizar o vínculo nos próximos atendimentos do mesmo veículo.

Uma placa já cadastrada em conta autenticada não ganha outro cadastro sem login quando falta autorização. O desktop informa que precisa do código. Clientes avulsos com placa desconhecida continuam aceitos; novos atendimentos da mesma placa pela mesma oficina reutilizam os registros. Se outra oficina tentar usar uma placa avulsa já cadastrada, o sistema exige conferência administrativa do vínculo.

O banco mantém apenas um veículo ativo por placa normalizada (sem espaços/hífen e em maiúsculas). Essa regra também protege o cadastro web/mobile e solicitações simultâneas. Veículos removidos da lista preservam o histórico; uma O.S. existente continua visível ao proprietário. Para um novo atendimento, o cliente deve cadastrar novamente o veículo removido e autorizar o vínculo.

## Ativação

### Preenchimento automático pela placa

No desktop, digitar uma placa completa na abertura da O.S. consulta o cadastro do AutoFlow e preenche **Marca / Modelo / Ano** e **Nome do Proprietário / Cliente**. A consulta começa após uma breve pausa na digitação ou ao sair do campo. O botão **Buscar** permite repetir em caso de falha de conexão.

Veículos já atendidos pela oficina são preenchidos só pela placa. No primeiro atendimento, informar o código de vínculo também dispara a consulta; a prévia não consome o código, que continua válido até salvar a O.S. Placas desconhecidas permitem preenchimento manual. Dados ausentes, como o ano de um cadastro antigo, não são inventados. Placas de outras contas só revelam nome e dados após autorização; mudar a placa ou fechar a tela descarta respostas anteriores e limpa os campos.

Ativar com `20261023154200_workshop_vehicle_lookup.sql` e atualizar o desktop. A consulta é somente leitura e não cria cliente, veículo ou ordem. Os dados preenchidos ficam protegidos contra edição no formulário da O.S.; alterações cadastrais devem ser feitas no cadastro de origem.

### Migrações do vínculo

Aplicar a migração `20261021121433_vehicle_workshop_link.sql` e atualizar conjuntamente web, mobile e desktop. Publicar somente o front-end não ativa as RPCs.

A migração `20261023143914_client_vehicle_repair_audit.sql` cria o arquivo privado dos reparos autorizados. Antes de aplicar `20261023143917_vehicle_plate_integrity.sql`, conferir e consolidar eventuais placas ativas duplicadas. A criação do índice único falha se ainda houver duplicatas; não escolhe um proprietário automaticamente.

A migração cria uma tabela privada com RLS, RPCs restritas a usuários autenticados, autorização do proprietário, validação da oficina aprovada, expiração e consumo atômico do código. As funções públicas são `security invoker`; a implementação privilegiada fica no schema privado, com `search_path` vazio.

## Ordens antigas

A migração não transfere O.S. antigas automaticamente por nome ou placa. Um reparo pontual exige conferir os registros e autorizar os IDs de origem e destino. Na consolidação, guardar os registros antes/depois e o mapeamento em `private.client_vehicle_repair_audit`, corrigir as referências das O.S. e remover somente as cópias sem outros vínculos, tudo na mesma transação. Preservar status, datas, descrições, avaliações, fotos e a exclusão da lista de veículos. A tabela de reparos não está acessível aos clientes ou oficinas pela API.

## Validação

```sh
node --test tests/vehicle-workshop-link.test.mjs
python -m unittest discover -s tests -p "test_order_service.py"
node --test tests/workshop-vehicle-lookup.test.mjs
QT_QPA_PLATFORM=offscreen python -m unittest discover -s tests -p "test_order_autofill.py"
npm run build --prefix mobile
npm run lint --prefix mobile
```

Os testes de PostgreSQL local reproduzem o cadastro duplicado e o desaparecimento da O.S. para o cliente, verificam o vínculo correto, impedem acesso por outro cliente, recusam oficina bloqueada/código inválido/expirado/usado e verificam a continuidade do cadastro avulso. Nenhum teste altera dados de produção.
