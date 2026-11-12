"""Criação de O.S. com consentimento do cliente para vincular seu veículo cadastrado."""
import re
from input_rules import link_code_value, text_value, money_value


def normalize_plate(value):
    source = str(value or '').strip()
    return re.sub(r"[ -]", "", source).upper() if re.fullmatch(r'[A-Za-z0-9 -]*', source) else source


def valid_plate(value):
    return bool(re.fullmatch(r"[A-Z]{3}[0-9][A-Z0-9][0-9]{2}", normalize_plate(value)))


def lookup_vehicle(db, plate, link_code=""):
    plate = normalize_plate(plate)
    if not valid_plate(plate):
        raise ValueError("Informe uma placa válida.")
    return db.rpc("lookup_workshop_vehicle", {
        "p_plate": plate, "p_link_code": link_code_value(link_code) or None,
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
    if "Aguarde um instante" in message:
        return message
    return "Não foi possível consultar a placa. Confira a conexão e clique em Buscar para tentar novamente."

def create_order(db, payload, link_code=""):
    params = dict(payload)
    params['p_plate'] = normalize_plate(params.get('p_plate'))
    if not valid_plate(params['p_plate']):
        raise ValueError('Informe uma placa válida.')
    params['p_client'] = text_value(params.get('p_client'), 'Nome do cliente', 150, 2)
    params['p_model'] = text_value(params.get('p_model'), 'Veículo', 150, 1)
    params['p_problem'] = text_value(params.get('p_problem'), 'Descrição do problema', 4000, 1, True)
    if params.get('p_status') not in ('aguardando', 'em_analise', 'em_manutencao'):
        raise ValueError('Status inválido para uma nova ordem de serviço.')
    code = link_code_value(link_code)
    if any(key in params for key in ('p_services', 'p_labor', 'p_parts')):
        params['p_services'] = text_value(params.get('p_services'), 'Peças e serviços', 4000, 0, True)
        params['p_labor'] = money_value(params.get('p_labor', 0))
        params['p_parts'] = money_value(params.get('p_parts', 0))
        params['p_link_code'] = code or None
        return db.rpc('create_workshop_order_validated', params).execute().data
    function = "create_workshop_order"
    if code:
        function = "create_workshop_order_with_link"
        params["p_link_code"] = code
    return db.rpc(function, params).execute().data


def order_error(error):
    if isinstance(error, ValueError):
        return str(error)
    message = str(getattr(error, "message", "") or error)
    if "create_workshop_order_with_link" in message and ("schema cache" in message or "Could not find" in message):
        return "O vínculo de veículos ainda precisa ser ativado pelo responsável do AutoFlow."
    for text in ("código", "Código", "cliente", "placa", "Dados da ordem", "Oficina sem aprovação"):
        if text in message:
            return message
    return "Não foi possível salvar. Confira os dados e a conexão. Verifique as O.S. antes de tentar novamente."
