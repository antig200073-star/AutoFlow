import os
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Header
from supabase import create_client, Client

load_dotenv()

URL: str = os.getenv("SUPABASE_URL")
KEY: str = os.getenv("SUPABASE_KEY")

supabase: Client = create_client(URL, KEY)
app = FastAPI()

@app.post("/auth/callback-google")
def callback_google(authorization: str = Header(None)):
    """
    Recebe o token JWT vindo do Front-end após o login com o Google,
    valida o usuário e verifica se ele já existe em public.tb_cli.
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Token não fornecido")

    token = authorization.split(" ")[1] if " " in authorization else authorization
    
    # 1. Obtém dados do usuário autenticado no auth.users do Supabase
    user_res = supabase.auth.get_user(token)
    
    if not user_res.user:
        raise HTTPException(status_code=401, detail="Sessão inválida")

    user_email = user_res.user.email
    user_nome = user_res.user.user_metadata.get("full_name", user_email)

    # 2. Verifica se o cliente já existe na sua tabela tb_cli
    cliente_existente = supabase.table("tb_cli").select("*").eq("email", user_email).execute()

    if not cliente_existente.data:
        # 3. Se não existir, cadastra o novo cliente na tb_cli
        novo_cliente = supabase.table("tb_cli").insert({
            "nome": user_nome,
            "email": user_email
        }).execute()
        
        return {
            "mensagem": "Cliente cadastrado com sucesso!",
            "cliente": novo_cliente.data[0]
        }

    return {
        "mensagem": "Cliente já cadastrado",
        "cliente": cliente_existente.data[0]
    }