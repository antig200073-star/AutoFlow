"""Regras de sessão da oficina. O banco aplica a autorização em cada operação."""
import json

WORKSHOP_FIELDS = "id,user_id,nome,cnpj,status,motivo_status,revisao"
STATUS_MESSAGES = {
    "pendente": "Cadastro aguardando verificação administrativa.",
    "em_verificacao": "Seu cadastro está em verificação pela administração.",
    "rejeitada": "Cadastro rejeitado. Entre em contato com a administração.",
    "bloqueada": "Acesso bloqueado. Entre em contato com a administração.",
}


def current_workshop(client):
    response = client.auth.get_user()
    if not response or not response.user:
        raise PermissionError("Sessão encerrada. Entre novamente.")
    result = client.table("oficinas").select(WORKSHOP_FIELDS).eq("user_id", response.user.id).execute()
    return result.data[0] if result.data else None


def require_approved(client):
    workshop = current_workshop(client)
    if not workshop or workshop.get("status") != "aprovada":
        raise PermissionError(STATUS_MESSAGES.get((workshop or {}).get("status"), "Conclua o cadastro da oficina."))
    return workshop


def register_workshop(client, cnpj):
    # Nunca envia senha, status, user_id, situação cadastral ou dados empresariais
    # escolhidos pelo usuário. A função resolve tudo no servidor.
    try:
        result = client.functions.invoke("register-workshop", invoke_options={"body": {"cnpj": cnpj}})
    except Exception as error:
        # supabase-functions 2.x expõe a mensagem JSON da Edge Function em .message.
        if getattr(error, "name", None) == "FunctionsHttpError":
            raise ValueError(error.message) from error
        context = getattr(error, "context", None)
        try:
            payload = json.loads(context) if isinstance(context, (bytes, str)) else context
            message = payload.get("error") if isinstance(payload, dict) else None
        except (ValueError, TypeError):
            message = None
        raise ValueError(message or "Não foi possível verificar o CNPJ. Confira os dados e tente novamente.") from error
    payload = json.loads(result) if isinstance(result, (bytes, str)) else result
    if not isinstance(payload, dict):
        raise ValueError("Cadastro não confirmado.")
    if not payload.get("success"):
        raise ValueError(payload.get("error", "Cadastro não confirmado."))
    return payload
