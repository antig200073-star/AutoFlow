"""Criação de O.S. com consentimento do cliente para vincular seu veículo cadastrado."""

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
