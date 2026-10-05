import sys
from PyQt5 import QtWidgets, uic
from PyQt5.QtWidgets import QMessageBox
import re
from datetime import date
from pathlib import Path
from PyQt5.QtGui import QIcon, QPixmap
from PyQt5.QtCore import Qt
BASE_DIR = Path(__file__).resolve().parent
# Importa a conexão configurada no arquivo database.py
from database import supabase
# Oficina logada
oficina_logada = None
# ==========================================
# FUNÇÕES DE TRANSIÇÃO DE TELAS
# ==========================================
def tela_login():
    form.show()
    form_cad.close()
    form_prin.close()

def tela_cadastro():
    form.close()
    form_cad.show()
    form_prin.close()

def tela_inicio():
    form.close()
    form_cad.close()
    carregar_dashboard()
    form_prin.show()

def abrir_veipatio():
    form_patio.exec_()

# ==========================================
# LÓGICA DE CADASTRO DA OFICINA
# ==========================================
def cadastrar_usuario():
    nome = form_cad.txtNomeOficina.text().strip()
    cnpj = form_cad.txtCnpj.text().strip()
    email = form_cad.txtEmail.text().strip()
    senha = form_cad.txtSenha.text().strip()
    telefone = form_cad.txtTelefone.text().strip()
    cep = form_cad.txtCep.text().strip()
    logradouro = form_cad.txtLogradouro.text().strip()
    numero = form_cad.txtNumero.text().strip()
    bairro = form_cad.txtBairro.text().strip()
    cidade = form_cad.txtCidade.text().strip()
    estado = form_cad.txtEstado.text().strip()

    if not nome or not email or not cnpj or not senha:
        QMessageBox.warning(form_cad, "Aviso", "Preencha ao menos Nome, CNPJ, E-mail e Senha!")
        return

    if not supabase:
        QMessageBox.critical(form_cad, "Erro", "Sem conexão com o Supabase!")
        return

    try:
        # Check de e-mail existente
        res = supabase.table("oficinas").select("email").eq("email", email).execute()
        if len(res.data) > 0:
            QMessageBox.warning(form_cad, "Aviso", "Este e-mail já está cadastrado!")
            return

        # Sanitização dos campos
        cnpj_limpo = re.sub(r'\D', '', cnpj)[:14]
        cep_limpo = re.sub(r'\D', '', cep)[:8]
        telefone_limpo = re.sub(r'\D', '', telefone)[:15]
        estado_limpo = estado.strip().upper()[:2]

        dados = {
            "nome": nome,
            "cnpj": cnpj_limpo,
            "email": email,
            "senha": senha,
            "telefone": telefone_limpo,
            "cep": cep_limpo,
            "logradouro": logradouro,
            "numero": numero,
            "bairro": bairro,
            "cidade": cidade,
            "estado": estado_limpo
        }

        supabase.table("oficinas").insert(dados).execute()

        QMessageBox.information(form_cad, "Sucesso", "Oficina cadastrada com sucesso!")
        limpar_campos_cadastro()
        tela_login()

    except Exception as erro:
        QMessageBox.critical(form_cad, "Erro no Banco", f"Falha ao cadastrar: {erro}")

def limpar_campos_cadastro():
    campos = [
        form_cad.txtNomeOficina, form_cad.txtCnpj, form_cad.txtEmail, form_cad.txtSenha,
        form_cad.txtTelefone, form_cad.txtCep, form_cad.txtLogradouro,
        form_cad.txtNumero, form_cad.txtBairro, form_cad.txtCidade, form_cad.txtEstado
    ]
    for campo in campos:
        campo.clear()

def efetuar_login():
    global oficina_logada
    usuario_email = form.txtUsuario.text().strip()
    senha = form.txtSenha.text().strip()

    if not usuario_email or not senha:
        QMessageBox.warning(form, "Aviso", "Digite o e-mail e a senha!")
        return

    if not supabase:
        QMessageBox.critical(form, "Erro", "Sem conexão com o Supabase!")
        return

    try:
        res = supabase.table("oficinas").select("*").eq("email", usuario_email).eq("senha", senha).execute()

        if len(res.data) > 0:
            oficina_logada = res.data[0]  # Guarda os dados da oficina (incluindo o ID)
            form.txtUsuario.clear()
            form.txtSenha.clear()
            tela_inicio()
        else:
            QMessageBox.warning(form, "Erro de Autenticação", "E-mail ou senha incorretos!")

    except Exception as erro:
        QMessageBox.critical(form, "Erro", f"Falha na autenticação: {erro}")

def limpar_campos_cadastro():
    campos = [
        form_cad.txtNomeOficina, form_cad.txtCnpj, form_cad.txtEmail,
        form_cad.txtTelefone, form_cad.txtCep, form_cad.txtLogradouro,
        form_cad.txtNumero, form_cad.txtBairro, form_cad.txtCidade, form_cad.txtEstado
    ]
    for campo in campos:
        campo.clear()

# ==========================================
# tela principal
# ==========================================
def carregar_dashboard():
    if not supabase:
        return

    try:
        # 1. Veículos no Pátio (tb_veiculo)
        res_patio = supabase.table("tb_veiculo").select("id_veiculo", count="exact").execute()
        qtd_patio = res_patio.count if res_patio.count is not None else 0
        form_prin.lblV1.setText(str(qtd_patio))

        # 2. O.S. em Andamento (Status: em_analise ou em_manutencao)
        res_os = supabase.table("ordens_servico") \
            .select("id", count="exact") \
            .in_("status", ["em_analise", "em_manutencao"]) \
            .execute()
        qtd_os = res_os.count if res_os.count is not None else 0
        form_prin.lblV2.setText(str(qtd_os))

        # 3. Aguardando Peças (Status: aguardando)
        res_pecas = supabase.table("ordens_servico") \
            .select("id", count="exact") \
            .eq("status", "aguardando") \
            .execute()
        qtd_pecas = res_pecas.count if res_pecas.count is not None else 0
        form_prin.lblV3.setText(str(qtd_pecas))

        # 4. Concluídas Hoje (Status: pronto ou entregue no dia de hoje)
        hoje = date.today().isoformat()
        res_concluidas = supabase.table("ordens_servico") \
            .select("id", count="exact") \
            .in_("status", ["pronto", "entregue"]) \
            .gte("data_entrada", hoje) \
            .execute()
        qtd_concluidas = res_concluidas.count if res_concluidas.count is not None else 0
        form_prin.lblV4.setText(str(qtd_concluidas))

    except Exception as erro:
        print(f"Erro ao carregar dashboard: {erro}")

# ==========================================
# CADASTRO DE OS
# ==========================================
STATUS_MAP = {
    "Em Diagnóstico": "em_analise",
    "Aguardando Peças": "aguardando",
    "Em Manutenção": "em_manutencao",
    "Aguardando Aprovação": "aguardando"
}
def abrir_cad_os():
    # Limpa os campos antes de abrir
    form_cad_os.txtPlaca.clear()
    form_cad_os.txtVeiculo.clear()
    form_cad_os.txtCliente.clear()
    form_cad_os.txtDefeito.clear()
    form_cad_os.txtPecasServicos.clear()
    form_cad_os.spinMaoObra.setValue(0.0)
    form_cad_os.spinPecas.setValue(0.0)

    form_cad_os.show()

def salvar_ordem_servico():
    global oficina_logada

    # 1. Tratamento da placa: remove espaços e hífens, tornando tudo maiúsculo
    placa_bruta = form_cad_os.txtPlaca.text().strip().upper()
    placa_limpa = placa_bruta.replace("-", "").replace(" ", "")

    modelo_texto = form_cad_os.txtVeiculo.text().strip()
    cliente_nome = form_cad_os.txtCliente.text().strip()
    defeito = form_cad_os.txtDefeito.toPlainText().strip()
    status_tela = form_cad_os.cmbStatus.currentText()

    status_banco = STATUS_MAP.get(status_tela, "aguardando")

    if not placa_limpa or not cliente_nome:
        QMessageBox.warning(form_cad_os, "Aviso", "Preencha a placa do veículo e o nome do cliente.")
        return

    try:
        # 2. Busca o cliente (ou insere se não existir)
        res_cli = supabase.table("tb_cli").select("id_cliente").ilike("nome", cliente_nome).execute()
        if res_cli.data:
            cliente_id = res_cli.data[0]["id_cliente"]
        else:
            novo_cli = supabase.table("tb_cli").insert({"nome": cliente_nome}).execute()
            cliente_id = novo_cli.data[0]["id_cliente"]

        # 3. Busca a placa usando busca flexível (ILIKES ignora maiúsculas/minúsculas)
        # Tenta buscar tanto pela placa limpa quanto pela placa bruta digitada
        res_veiculo = supabase.table("tb_veiculo").select("id_veiculo") \
            .or_(f"placa.ilike.{placa_limpa},placa.ilike.{placa_bruta}") \
            .execute()

        if res_veiculo.data:
            veiculo_id = res_veiculo.data[0]["id_veiculo"]
        else:
            # Se não encontrou de forma alguma, grava o novo veículo padronizado (sem hífen)
            novo_veiculo = supabase.table("tb_veiculo").insert({
                "placa": placa_limpa,
                "modelo": modelo_texto,
                "cliente_id": cliente_id
            }).execute()
            veiculo_id = novo_veiculo.data[0]["id_veiculo"]

        # 4. Registra a O.S.
        oficina_id = oficina_logada["id"] if oficina_logada else 1
        dados_os = {
            "oficina_id": oficina_id,
            "cliente_id": cliente_id,
            "veiculo_id": veiculo_id,
            "status": status_banco,
            "descricao_problema": defeito
        }

        resposta = supabase.table("ordens_servico").insert(dados_os).execute()

        if resposta.data:
            QMessageBox.information(form_cad_os, "Sucesso", "Ordem de Serviço criada com sucesso!")
            form_cad_os.close()
            carregar_dashboard()

    except Exception as erro:
        QMessageBox.critical(form_cad_os, "Erro no Banco", f"Falha ao salvar O.S.: {erro}")


# ==========================================
# INICIALIZAÇÃO DA APLICAÇÃO
# ==========================================
app = QtWidgets.QApplication(sys.argv)
app.setApplicationName("AutoFlow")
app.setStyle("Fusion")
app.setStyleSheet((BASE_DIR / "autoflow.qss").read_text(encoding="utf-8"))
app.setWindowIcon(QIcon(str(BASE_DIR / "assets/logo-autoflow.jpg")))

form = uic.loadUi(str(BASE_DIR / "t_loguin.ui"))
form_cad = uic.loadUi(str(BASE_DIR / "t_cad.ui"))
form_prin = uic.loadUi(str(BASE_DIR / "t_prin.ui"))
form_cad_os = uic.loadUi(str(BASE_DIR / "t_cadOs.ui"))
form_patio = uic.loadUi(str(BASE_DIR / "t_veipatio.ui"))

# Logo original e apresentação consistente nas janelas.
for window in (form, form_cad, form_prin, form_cad_os, form_patio):
    window.setWindowIcon(app.windowIcon())
    label = window.findChild(QtWidgets.QLabel, "lblLogo")
    if label is not None:
        label.setScaledContents(False)
        label.setAlignment(Qt.AlignCenter)
        label.setPixmap(QPixmap(str(BASE_DIR / "assets/logo-autoflow.jpg")).scaled(
            180, 180, Qt.KeepAspectRatio, Qt.SmoothTransformation))
    for table in window.findChildren(QtWidgets.QTableWidget):
        table.setAlternatingRowColors(True)
        table.verticalHeader().setDefaultSectionSize(48)
        table.setSelectionBehavior(QtWidgets.QAbstractItemView.SelectRows)

# Eventos - Autenticação
form.btnEntrar.clicked.connect(efetuar_login)
form.btnCadastrarOficina.clicked.connect(tela_cadastro)

form_cad.btnCadastrar.clicked.connect(cadastrar_usuario)
form_cad.btnVoltar.clicked.connect(tela_login)

# Eventos - Tela Principal (Dashboard)
form_prin.btnNovaOS.clicked.connect(abrir_cad_os)
form_prin.btnNovoVeiculo.clicked.connect(abrir_veipatio)
form_prin.btnSair.clicked.connect(tela_login)

# Eventos - Cadastro de O.S. (t_lcadOs.ui)
form_cad_os.btnSalvarOS.clicked.connect(salvar_ordem_servico)
form_cad_os.btnCancelar.clicked.connect(form_cad_os.close)

# Eventos - Pátio
form_patio.btnVoltar.clicked.connect(form_patio.close)

form.show()
sys.exit(app.exec_())
