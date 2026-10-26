# Atividade de 26/10/2026 - Relatório de ordens de serviço

Funcionalidade escolhida: gerenciamento de ordens de serviço no desktop AutoFlow.
Foi adicionada a opção **Relatório de O.S. (PDF)** ao menu lateral da oficina.

## Instalar e usar

Na raiz do projeto:

```bash
python -m pip install -r qt/requirements.txt
python main.py
```

1. Entre com uma conta de oficina aprovada.
2. No painel, use a busca para filtrar as ordens, se desejar.
3. Clique em **Relatório de O.S. (PDF)**.
4. Escolha o nome e a pasta. Aguarde a confirmação de salvamento.

O botão confere o acesso da oficina e atualiza a tabela antes de exportar. O PDF
contém número da O.S., placa, veículo, cliente, serviço/defeito, status e entrada,
além de oficina, emissão, busca aplicada, total, resumo por status e páginas.
Inclui dois gráficos vetoriais de barras: entradas e saídas por dia nos últimos
sete dias (UTC-03:00) e quantidade de atendimentos em cada status. A movimentação
usa `data_entrada` e `data_saida`, que já são registradas no sistema. Uma saída
sem data não é inventada a partir do status: o PDF informa datas ausentes/inválidas.
Cada O.S. conta como um atendimento; o mesmo veículo pode ter várias O.S.
O gráfico de status inclui todas as ordens exportadas; o de movimentação conta
apenas eventos dessas ordens dentro dos sete dias. Portanto, os gráficos refletem
o mesmo filtro e limite da tabela, não o movimento integral da oficina.
Exporta somente as linhas visíveis das 200 ordens mais recentes por número,
preservando a busca e a ordenação da tela. Não é uma exportação integral do banco.
Sem resultados, o aplicativo avisa e não cria um arquivo vazio.

## Gerar o exemplo da atividade sem banco

```bash
python qt/demo_order_report.py
```

O arquivo `AutoFlow_Relatorio_OS_Teste.pdf` é criado na pasta atual. O exemplo
usa seis ordens fictícias, identificadas como demonstração acadêmica, e o mesmo
gerador usado pelo botão. Os registros não são inseridos no Supabase.

## Arquivos e validação

- `qt/order_report.py`: leitura da tabela visível e geração do PDF com ReportLab.
- `qt/main.py`: botão, verificação de acesso e seleção do destino.
- `qt/requirements.txt`: inclui ReportLab 4.4.9.
- `qt/demo_order_report.py`: exemplo reproduzível para a atividade.
- `tests/test_order_report.py`: filtro, lista vazia, caracteres especiais,
  descrições longas, paginação, datas de movimentação, fuso horário, status sem
  ocorrências e preservação de arquivo em caso de entrada inválida.

```bash
python -m unittest discover -s tests -p 'test_order_report.py'
```

Os testes locais usam dados fictícios. A validação final com uma conta real de
oficina deve ser feita no computador que executa o AutoFlow.
