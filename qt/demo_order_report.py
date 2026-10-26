"""Gera o PDF da atividade com dados fictícios, sem login nem banco de dados."""
from datetime import datetime, timezone, timedelta
from pathlib import Path
import argparse

from order_report import generate_order_report
from order_rows import order_row_values


def demo_rows():
    examples = [
        (1006, "TST0A06", "Chevrolet", "Onix", "Cliente Teste 06", "Ruído na suspensão dianteira; verificar buchas e amortecedores.", "em_analise"),
        (1005, "TST0A05", "Fiat", "Argo", "Cliente Teste 05", "Substituição do conjunto de embreagem; aguardando chegada das peças.", "aguardando"),
        (1004, "TST0A04", "Volkswagen", "Gol", "Cliente Teste 04", "Troca de óleo, filtro e revisão do sistema de arrefecimento.", "em_manutencao"),
        (1003, "TST0A03", "Hyundai", "HB20", "Cliente Teste 03", "Revisão de freios concluída e teste de rodagem realizado.", "pronto"),
        (1002, "TST0A02", "Toyota", "Corolla", "Cliente Teste 02", "Alinhamento e balanceamento concluídos; veículo entregue.", "entregue"),
        (1001, "TST0A01", "Chevrolet", "Opala", "Cliente Teste 01", "Diagnóstico de falha na ignição e verificação das velas.", "em_analise"),
    ]
    return [order_row_values({
        "id": number, "tb_veiculo": {"placa": plate, "marca": brand, "modelo": model},
        "tb_cli": {"nome": client}, "descricao_problema": problem, "status": status,
        "data_entrada": "2026-10-26T08:30:00",
    }) for number, plate, brand, model, client, problem, status in examples]


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", default="AutoFlow_Relatorio_OS_Teste.pdf")
    args = parser.parse_args()
    destination = Path(args.output).resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)
    result = generate_order_report(
        destination, demo_rows(), "Oficina de Demonstração AutoFlow", demo=True,
        generated_at=datetime(2026, 10, 26, 10, 0, tzinfo=timezone(timedelta(hours=-3))))
    print(f"PDF gerado: {result}")
