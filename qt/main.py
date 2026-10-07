import sys
from PyQt5 import QtWidgets, uic
from PyQt5.QtWidgets import QMessageBox
from datetime import date
from pathlib import Path
from PyQt5.QtGui import QIcon, QPixmap
from PyQt5.QtCore import Qt
BASE_DIR = Path(__file__).resolve().parent
# Importa a conexão configurada no arquivo database.py
from database import supabase
from workshop_auth import current_workshop, require_approved, register_workshop, STATUS_MESSAGES
from PyQt5.QtCore import QTimer
oficina_logada = None


def tela_login():
    global oficina_logada
    oficina_logada = None
    for window in (form_cad, form_prin, form_cad_os, form_patio, form_status):
        window.close()
    try:
        if supabase:
            supabase.auth.sign_out()
    except Exception:
        pass
    form.txtSenha.clear()
    form_cad.txtSenha.clear()
    form_cad.txtEmail.setReadOnly(False)
    form_cad.txtSenha.setEnabled(True)
    form.show()


def tela_cadastro():
    form.close()
    form_prin.close()
    form_status.close()
    form_cad.show()


def mostrar_status(workshop):
    for window in (form, form_cad, form_prin, form_cad_os, form_patio):
        window.close()
    status_label.setText(STATUS_MESSAGES.get(workshop.get("status"), "Cadastro sem aprovação."))
    status_detail.setText(workshop.get("motivo_status") or "O painel será liberado após a confirmação da oficina e do seu vínculo com ela.")
    form_status.show()


def conferir_acesso():
    global oficina_logada
    oficina_logada = current_workshop(supabase)
    if not oficina_logada:
        user = supabase.auth.get_user().user
        form_cad.txtEmail.setText(user.email)
        form_cad.txtEmail.setReadOnly(True)
        form_cad.txtSenha.setEnabled(False)
        form_cad.txtSenha.clear()
        tela_cadastro()
    elif oficina_logada.get("status") != "aprovada":
        mostrar_status(oficina_logada)
    else:
        for window in (form, form_cad, form_status):
            window.close()
        if carregar_dashboard():
            form_prin.show()


def atualizar_acesso():
    try:
        conferir_acesso()
    except Exception:
        QMessageBox.warning(form_status, "Conexão", "Não foi possível conferir seu acesso. Entre novamente.")
        tela_login()


def acesso_aprovado():
    global oficina_logada
    try:
        oficina_logada = require_approved(supabase)
        return True
    except Exception as error:
        for window in (form_prin, form_cad_os, form_patio):
            window.close()
        status_label.setText(str(error) if isinstance(error, PermissionError) else "Não foi possível verificar o acesso.")
        status_detail.setText("Atualize o status ou saia e entre novamente.")
        form_status.show()
        return False


def abrir_veipatio():
    if acesso_aprovado():
        form_patio.exec_()


def cadastrar_usuario():
    email = form_cad.txtEmail.text().strip()
    senha = form_cad.txtSenha.text()  # Preserva espaços válidos da senha.
    cnpj = form_cad.txtCnpj.text().strip()
    if not email or not cnpj:
        QMessageBox.warning(form_cad, "Cadastro", "Informe e-mail e CNPJ.")
        return
    if not supabase:
        QMessageBox.critical(form_cad, "Conexão", "Não foi possível iniciar a conexão.")
        return
    form_cad.btnCadastrar.setEnabled(False)
    try:
        session = supabase.auth.get_session()
        if not session:
            if len(senha) < 8:
                raise ValueError("Use uma senha com pelo menos 8 caracteres.")
            result = supabase.auth.sign_up({"email": email, "password": senha})
            form_cad.txtSenha.clear()
            if not result.session:
                QMessageBox.information(form_cad, "Confirme seu e-mail", "Se o e-mail estiver disponível, você receberá uma confirmação. Confirme o e-mail, entre na conta e informe o CNPJ para concluir o cadastro. Se já tem conta, entre com sua senha.")
                tela_login()
                return
        register_workshop(supabase, cnpj)
        form_cad.txtSenha.clear()
        conferir_acesso()
    except Exception as error:
        message = str(error) if isinstance(error, ValueError) else "Não foi possível cadastrar. Se já tem conta, volte e entre com sua senha."
        QMessageBox.warning(form_cad, "Cadastro", message)
    finally:
        form_cad.btnCadastrar.setEnabled(True)


def efetuar_login():
    email = form.txtUsuario.text().strip()
    senha = form.txtSenha.text()
    if not email or not senha:
        QMessageBox.warning(form, "Login", "Digite o e-mail e a senha.")
        return
    form.btnEntrar.setEnabled(False)
    try:
        supabase.auth.sign_in_with_password({"email": email, "password": senha})
        form.txtSenha.clear()
        conferir_acesso()
    except Exception:
        QMessageBox.warning(form, "Login", "Não foi possível entrar. Confira e-mail, senha, confirmação de e-mail e conexão.")
    finally:
        form.btnEntrar.setEnabled(True)


# ==========================================
# tela principal
# ==========================================
def carregar_dashboard():
    if not acesso_aprovado():
        return False

    try:
        # 1. Veículos no Pátio (tb_veiculo)
        res_patio = supabase.table("ordens_servico").select("veiculo_id").eq("oficina_id", oficina_logada["id"]).neq("status", "entregue").execute()
        qtd_patio = len({row["veiculo_id"] for row in res_patio.data})
        form_prin.lblV1.setText(str(qtd_patio))

        # 2. O.S. em Andamento (Status: em_analise ou em_manutencao)
        res_os = supabase.table("ordens_servico") \
            .select("id", count="exact") \
            .eq("oficina_id", oficina_logada["id"]) \
            .in_("status", ["em_analise", "em_manutencao"]) \
            .execute()
        qtd_os = res_os.count if res_os.count is not None else 0
        form_prin.lblV2.setText(str(qtd_os))

        # 3. Aguardando Peças (Status: aguardando)
        res_pecas = supabase.table("ordens_servico") \
            .select("id", count="exact") \
            .eq("oficina_id", oficina_logada["id"]) \
            .eq("status", "aguardando") \
            .execute()
        qtd_pecas = res_pecas.count if res_pecas.count is not None else 0
        form_prin.lblV3.setText(str(qtd_pecas))

        # 4. Concluídas Hoje (Status: pronto ou entregue no dia de hoje)
        hoje = date.today().isoformat()
        res_concluidas = supabase.table("ordens_servico") \
            .select("id", count="exact") \
            .eq("oficina_id", oficina_logada["id"]) \
            .in_("status", ["pronto", "entregue"]) \
            .gte("data_entrada", hoje) \
            .execute()
        qtd_concluidas = res_concluidas.count if res_concluidas.count is not None else 0
        form_prin.lblV4.setText(str(qtd_concluidas))
        return True

    except Exception as erro:
        status_label.setText("Não foi possível carregar o painel.")
        status_detail.setText("Confira sua conexão e atualize o status para tentar novamente.")
        form_prin.close()
        form_status.show()
        return False

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
    if not acesso_aprovado():
        return
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
    if not acesso_aprovado():
        return
    try:
        supabase.rpc("create_workshop_order", {
            "p_plate": form_cad_os.txtPlaca.text().strip(),
            "p_model": form_cad_os.txtVeiculo.text().strip(),
            "p_client": form_cad_os.txtCliente.text().strip(),
            "p_problem": form_cad_os.txtDefeito.toPlainText().strip(),
            "p_status": STATUS_MAP.get(form_cad_os.cmbStatus.currentText(), "aguardando"),
        }).execute()
        QMessageBox.information(form_cad_os, "Sucesso", "Ordem de serviço criada.")
        form_cad_os.close()
        carregar_dashboard()
    except Exception:
        QMessageBox.warning(form_cad_os, "Ordem de serviço", "Não foi possível salvar. Confira placa, cliente e conexão. O cadastro precisa estar aprovado; uma placa já atendida deve manter o mesmo cliente.")


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

# Status persistente para cadastros pendentes e acesso revogado.
form_status = QtWidgets.QDialog()
form_status.setWindowTitle("AutoFlow • Verificação da oficina")
form_status.setMinimumSize(480, 260)
status_layout = QtWidgets.QVBoxLayout(form_status)
status_label = QtWidgets.QLabel()
status_label.setWordWrap(True)
status_label.setStyleSheet("font-size: 22px; font-weight: bold;")
status_detail = QtWidgets.QLabel()
status_detail.setWordWrap(True)
status_layout.addWidget(status_label)
status_layout.addWidget(status_detail)
refresh_status = QtWidgets.QPushButton("Atualizar status")
refresh_status.clicked.connect(atualizar_acesso)
status_layout.addWidget(refresh_status)
signout_status = QtWidgets.QPushButton("Sair")
signout_status.clicked.connect(tela_login)
status_layout.addWidget(signout_status)

# Revogação também fecha telas abertas. RLS protege as operações imediatamente.
access_timer = QTimer()
access_timer.setInterval(60000)
access_timer.timeout.connect(lambda: acesso_aprovado() if form_prin.isVisible() else None)
access_timer.start()

form.show()
sys.exit(app.exec_())
