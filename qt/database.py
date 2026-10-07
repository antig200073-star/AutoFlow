import os
from supabase import create_client, Client

# ==========================================
# CREDENCIAIS DO SUPABASE
# ==========================================
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://tohlfwbzmkjlivcpssbe.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_mhjRE7bumaGkOBsmv9TpBw_TwC49j6D")

def conectar_supabase() -> Client:
    """Inicializa e retorna o cliente do Supabase."""
    try:
        client = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("--- Supabase conectado com sucesso! ---")
        return client
    except Exception as e:
        print(f"Erro ao conectar no Supabase: {e}")
        return None

# Instância global para ser importada nos outros módulos
supabase = conectar_supabase()
