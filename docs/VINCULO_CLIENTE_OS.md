# Vínculo entre cliente, veículo e O.S.

Uma O.S. só aparece no web/mobile quando `ordens_servico.cliente_id` aponta para o perfil associado ao login do cliente. O cadastro avulso da oficina tem nome, mas não tem `auth_user_id`; por isso, copiar nome e placa não vincula a conta.

## Primeiro atendimento de um veículo já cadastrado

1. No web ou mobile, o cliente abre **Meus veículos → Vincular à oficina → Gerar código**.
2. Entrega o código somente à oficina escolhida. O código expira em 15 minutos, vale uma vez e é invalidado se outro for gerado.
3. A oficina preenche a placa e o código no cadastro da O.S. do desktop.
4. O banco usa os IDs do veículo e do proprietário autorizados pelo código. Não cria outra conta nem outro veículo.
5. O acompanhamento aparece na conta do cliente. A oficina pode reutilizar o vínculo nos próximos atendimentos do mesmo veículo.

Uma placa já cadastrada em conta autenticada não ganha outro cadastro sem login quando falta autorização. O desktop informa que precisa do código. Clientes avulsos sem placa cadastrada no aplicativo continuam aceitos.

## Ativação

Esta alteração depende da migração `20261021121433_vehicle_workshop_link.sql` e da atualização conjunta do web, mobile e desktop. Aplicar após aprovação da mudança no banco; publicar somente o front-end não ativa as RPCs.

A migração cria uma tabela privada com RLS, RPCs restritas a usuários autenticados, autorização do proprietário, validação da oficina aprovada, expiração e consumo atômico do código. As funções públicas são `security invoker`; a implementação privilegiada fica no schema privado, com `search_path` vazio.

## Ordens antigas

A migração não transfere O.S. antigas automaticamente por nome ou placa. Um reparo pontual exige conferir os registros e autorizar os IDs de origem e destino. O status e o histórico devem ser preservados.

## Validação

```sh
node --test tests/vehicle-workshop-link.test.mjs
python -m unittest discover -s tests -p "test_order_service.py"
npm run build --prefix mobile
npm run lint --prefix mobile
```

Os testes de PostgreSQL local reproduzem o cadastro duplicado e o desaparecimento da O.S. para o cliente, verificam o vínculo correto, impedem acesso por outro cliente, recusam oficina bloqueada/código inválido/expirado/usado e verificam a continuidade do cadastro avulso. Nenhum teste altera dados de produção.
