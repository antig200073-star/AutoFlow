"""Criação de O.S. com consentimento do cliente para vincular seu veículo cadastrado."""
import re


def normalize_plate(value):
    return re.sub(r"[ -]", "", str(value or "")).upper()


def valid_plate(value):
    return bool(re.fullmatch(r"[A-Z]{3}[0-9][A-Z0-9][0-9]{2}", normalize_plate(value)))


def lookup_vehicle(db, plate, link_code=""):
    plate = normalize_plate(plate)
    if not valid_plate(plate):
        raise ValueError("Informe uma placa válida.")
    return db.rpc("lookup_workshop_vehicle", {
        "p_plate": plate, "p_link_code": str(link_code or "").strip() or None,
    }).execute().data


def vehicle_description(vehicle):
    """Não inventa ano/marca quando o cadastro antigo só tem o modelo em texto."""
    year = vehicle.get("year")
    if isinstance(year, (float, int)) and float(year).is_integer():
        year = str(int(year))
    return " ".join(str(part).strip() for part in (
        vehicle.get("brand"), vehicle.get("model"), year,
    ) if part is not None and str(part).strip())


def lookup_error(error):
    message = str(getattr(error, "message", "") or error)
    if "lookup_workshop_vehicle" in message and ("schema cache" in message or "Could not find" in message):
        return "A consulta por placa precisa ser ativada pelo responsável do AutoFlow."
    if "Oficina sem aprovação" in message:
        return "O acesso da oficina precisa ser conferido. Entre novamente."
    return "Não foi possível consultar a placa. Confira a conexão e clique em Buscar para tentar novamente."

def create_order(db, payload, link_code=""):
    params = dict(payload)
    code = str(link_code or "").strip()
    function = "create_workshop_order"
    if code:
        function = "create_workshop_order_with_link"
        params["p_link_code"] = code
    return db.rpc(function, params).execute().data


def order_error(error):
    message = str(getattr(error, "message", "") or error)
    if "create_workshop_order_with_link" in message and ("schema cache" in message or "Could not find" in message):
        return "O vínculo de veículos ainda precisa ser ativado pelo responsável do AutoFlow."
    for text in ("código", "Código", "cliente", "placa", "Dados da ordem", "Oficina sem aprovação"):
        if text in message:
            return message
    return "Não foi possível salvar. Confira os dados e a conexão. Verifique as O.S. antes de tentar novamente."
