"""Formatação das ordens de serviço para o painel Qt (sem dependência de GUI)."""

from datetime import datetime

STATUS_LABELS = {
    "aguardando": "Aguardando peças",
    "em_analise": "Em Diagnóstico",
    "em_manutencao": "Em Manutenção",
    "pronto": "Pronto para retirada",
    "entregue": "Entregue",
}


def format_entry_date(value):
    if not value:
        return "—"
    try:
        moment = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if moment.tzinfo is not None:
            moment = moment.astimezone()
        return moment.strftime("%d/%m/%Y %H:%M")
    except (ValueError, TypeError):
        return str(value)


def order_row_values(order):
    """Retorna as sete colunas, mantendo dados ausentes identificados."""
    vehicle = order.get("tb_veiculo") or {}
    customer = order.get("tb_cli") or {}
    model = " ".join(filter(None, [vehicle.get("marca"), vehicle.get("modelo")]))
    return [
        str(order.get("id") or "—"),
        vehicle.get("placa") or "—",
        model or "—",
        customer.get("nome") or "—",
        order.get("descricao_problema") or "—",
        STATUS_LABELS.get(order.get("status"), order.get("status") or "—"),
        format_entry_date(order.get("data_entrada")),
    ]
