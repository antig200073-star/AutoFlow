import sys
from PyQt5 import QtWidgets, uic
from PyQt5.QtWidgets import QMessageBox, QTableWidgetItem, QHeaderView
from datetime import date
from pathlib import Path
from PyQt5.QtGui import QIcon, QPixmap
from PyQt5.QtCore import Qt
BASE_DIR = Path(__file__).resolve().parent
# Importa a conexão configurada no arquivo database.py
from database import supabase
from workshop_auth import current_workshop, require_approved, register_workshop, STATUS_MESSAGES
from order_rows import order_row_values, format_entry_date
from order_service import create_order, order_error
from order_autofill import OrderAutofill
from order_report import generate_order_report, visible_order_rows, visible_order_records
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
        carregar_patio()
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
def carregar_ordens_na_tabela():
    """Carrega as O.S. da oficina autenticada, com cliente e veículo vinculados."""
    response = (
        supabase.table("ordens_servico")
        .select(
            "id,status,descricao_problema,data_entrada,data_saida,"
            "tb_veiculo!ordens_servico_veiculo_id_fkey(placa,marca,modelo),"
            "tb_cli!ordens_servico_cliente_id_fkey(nome)"
        )
        .eq("oficina_id", oficina_logada["id"])
        .order("id", desc=True)
        .limit(200)
        .execute()
    )

    grid = form_prin.gridOS
    grid.setSortingEnabled(False)
    grid.setRowCount(0)
    for order in response.data or []:
        row_index = grid.rowCount()
        grid.insertRow(row_index)
        for column, value in enumerate(order_row_values(order)):
            cell = QTableWidgetItem(str(value))
            if column == 0:
                cell.setData(Qt.UserRole, order)
            cell.setFlags(cell.flags() & ~Qt.ItemIsEditable)
            cell.setToolTip(str(value))
            grid.setItem(row_index, column, cell)
    grid.setSortingEnabled(True)
    filtrar_ordens(form_prin.txtBuscar.text())


def filtrar_ordens(texto):
    """Filtra as colunas carregadas sem enviar consultas a cada tecla."""
    termo = (texto or "").strip().casefold()
    grid = form_prin.gridOS
    for linha in range(grid.rowCount()):
        campos = [
            (grid.item(linha, coluna).text() if grid.item(linha, coluna) else "")
            for coluna in range(grid.columnCount())
        ]
        grid.setRowHidden(linha, termo not in " ".join(campos).casefold())


def exportar_relatorio_os():
    """Atualiza os dados da oficina autorizada e exporta a busca atual."""
    if not acesso_aprovado():
        return
    btn_relatorio.setEnabled(False)
    try:
        carregar_ordens_na_tabela()
        rows = visible_order_rows(form_prin.gridOS)
        records = visible_order_records(form_prin.gridOS)
        if not rows:
            QMessageBox.information(form_prin, "Relatório", "Não há ordens para a busca atual.")
            return
        workshop_name = oficina_logada.get("nome") or "Oficina"
        search = form_prin.txtBuscar.text()
        path, _ = QtWidgets.QFileDialog.getSaveFileName(
            form_prin, "Salvar relatório de O.S.",
            str(Path.home() / f"AutoFlow_Ordens_{date.today().isoformat()}.pdf"),
            "Relatório PDF (*.pdf)")
        if not path:
            return
        destination = Path(path)
        if destination.suffix.lower() != ".pdf":
            destination = destination.with_name(destination.name + ".pdf")
            if destination.exists() and QMessageBox.question(
                form_prin, "Substituir arquivo?", f"O arquivo {destination.name} já existe. Substituir?"
            ) != QMessageBox.Yes:
                return
        result = generate_order_report(destination, rows, workshop_name, search=search, records=records)
        QMessageBox.information(form_prin, "Relatório gerado", f"PDF salvo em:\n{result}")
    except ImportError:
        QMessageBox.warning(form_prin, "Dependência", "Instale as dependências: python -m pip install -r qt/requirements.txt")
    except Exception as error:
        print("Falha ao gerar relatório:", repr(error), file=sys.stderr)
        QMessageBox.warning(form_prin, "Relatório", "Não foi possível gerar o PDF. Confira a conexão, a pasta e se o arquivo está aberto.")
    finally:
        btn_relatorio.setEnabled(True)


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
        carregar_ordens_na_tabela()
        return True

    except Exception as erro:
        print("Falha ao carregar dashboard / ordens:", repr(erro), file=sys.stderr)
        status_label.setText("Não foi possível carregar o painel.")
        status_detail.setText("Confira sua conexão e atualize o status para tentar novamente.")
        form_prin.close()
        form_status.show()
        return False

PATIO_STATUSES = {
    "Em Diagnóstico": "em_analise",
    "Aguardando Peças": "aguardando",
    "Em Manutenção": "em_manutencao",
    "Pronto para Retirada": "pronto",
    "Entregue": "entregue",
}
PATIO_LABELS = {v: k for k, v in PATIO_STATUSES.items()}
patio_orders = []

def carregar_patio():
    global patio_orders
    if not acesso_aprovado():
        return
    try:
        result = (
            supabase.table("ordens_servico")
            .select("id,status,data_entrada,veiculo_id,"
                    "tb_veiculo!ordens_servico_veiculo_id_fkey(placa,marca,modelo),"
                    "tb_cli!ordens_servico_cliente_id_fkey(nome)")
            .eq("oficina_id", oficina_logada["id"])
            .neq("status", "entregue")
            .order("data_entrada", desc=True)
            .limit(200)
            .execute()
        )
        patio_orders = result.data or []
        grid = form_patio.gridPatio
        grid.setSortingEnabled(False)
        grid.setRowCount(0)
        for order in patio_orders:
            vehicle = order.get("tb_veiculo") or {}
            owner = order.get("tb_cli") or {}
            model = " ".join(filter(None, [vehicle.get("marca"), vehicle.get("modelo")]))
            values = [
                vehicle.get("placa") or "—", model or "—",
                owner.get("nome") or "—",
                PATIO_LABELS.get(order.get("status"), order.get("status") or "—"),
                format_entry_date(order.get("data_entrada")),
                str(order["id"]),
            ]
            row = grid.rowCount()
            grid.insertRow(row)
            for col, value in enumerate(values):
                item = QTableWidgetItem(value)
                item.setFlags(item.flags() & ~Qt.ItemIsEditable)
                if col == 0:
                    item.setData(Qt.UserRole, order["id"])
                grid.setItem(row, col, item)
        grid.setSortingEnabled(True)
        filtrar_patio()
    except Exception as error:
        QMessageBox.warning(form_patio, "Pátio", f"Não foi possível carregar os veículos: {error}")

def filtrar_patio():
    term = form_patio.txtBuscarPatio.text().strip().casefold()
    selected = form_patio.cmbSetor.currentText()
    grid = form_patio.gridPatio
    for row in range(grid.rowCount()):
        values = [grid.item(row, col).text() if grid.item(row, col) else "" for col in range(grid.columnCount())]
        matches_status = selected == "Todos os Status" or values[3] == selected
        grid.setRowHidden(row, not (matches_status and term in " ".join(values).casefold()))

def alterar_status_patio():
    if not acesso_aprovado():
        return
    grid = form_patio.gridPatio
    row = grid.currentRow()
    if row < 0 or grid.isRowHidden(row):
        QMessageBox.information(form_patio, "Pátio", "Selecione um veículo da lista.")
        return
    item = grid.item(row, 0)
    if item is None:
        return
    order_id = item.data(Qt.UserRole)
    current = grid.item(row, 3).text()
    available = list(PATIO_STATUSES)
    new_status, accepted = QtWidgets.QInputDialog.getItem(
        form_patio, "Alterar status",
        f"O.S. nº {order_id} — selecione a nova etapa:", available,
        available.index(current) if current in available else 0, False
    )
    if not accepted or new_status == current:
        return
    if new_status == "Entregue":
        confirm = QMessageBox.question(
            form_patio, "Confirmar saída",
            f"Confirmar a entrega do veículo da O.S. nº {order_id}?"
        )
        if confirm != QMessageBox.Yes:
            return
    try:
        supabase.rpc("update_workshop_order_status", {
            "p_order_id": order_id, "p_status": PATIO_STATUSES[new_status]
        }).execute()
        carregar_patio()
        carregar_dashboard()
        QMessageBox.information(form_patio, "Status atualizado", "A etapa da manutenção foi atualizada.")
    except Exception as error:
        QMessageBox.warning(form_patio, "Não foi possível alterar", str(error))


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
    form_cad_os.txtCodigoVinculo.clear()
    form_cad_os.txtDefeito.clear()
    form_cad_os.txtPecasServicos.clear()
    form_cad_os.spinMaoObra.setValue(0.0)
    form_cad_os.spinPecas.setValue(0.0)

    form_cad_os.show()

def salvar_ordem_servico():
    if not order_autofill.can_submit():
        return
    if not acesso_aprovado():
        return
    try:
        create_order(supabase, {
            "p_plate": form_cad_os.txtPlaca.text().strip(),
            "p_model": form_cad_os.txtVeiculo.text().strip(),
            "p_client": form_cad_os.txtCliente.text().strip(),
            "p_problem": form_cad_os.txtDefeito.toPlainText().strip(),
            "p_status": STATUS_MAP.get(form_cad_os.cmbStatus.currentText(), "aguardando"),
        }, form_cad_os.txtCodigoVinculo.text())
        QMessageBox.information(form_cad_os, "Sucesso", "Ordem de serviço criada.")
        form_cad_os.close()
        carregar_dashboard()
    except Exception as error:
        QMessageBox.warning(form_cad_os, "Ordem de serviço", order_error(error))


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
order_autofill = OrderAutofill(form_cad_os, supabase)
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
btn_relatorio = QtWidgets.QPushButton("Relatório de O.S. (PDF)", form_prin)
btn_relatorio.setObjectName("btnRelatorioOS")
btn_relatorio.setProperty("class", "menuButton")
btn_relatorio.setToolTip("Exporta a busca atual entre as 200 O.S. mais recentes.")
form_prin.verticalLayoutSidebar.insertWidget(6, btn_relatorio)
btn_relatorio.clicked.connect(exportar_relatorio_os)
form_prin.btnNovaOS.clicked.connect(abrir_cad_os)
form_prin.btnNovoVeiculo.clicked.connect(abrir_veipatio)
form_prin.btnSair.clicked.connect(tela_login)
form_prin.txtBuscar.textChanged.connect(filtrar_ordens)
form_prin.gridOS.setEditTriggers(QtWidgets.QAbstractItemView.NoEditTriggers)
form_prin.gridOS.horizontalHeader().setSectionResizeMode(4, QHeaderView.Stretch)
for coluna, largura in {0: 75, 1: 95, 2: 140, 3: 145, 5: 110, 6: 130}.items():
    form_prin.gridOS.setColumnWidth(coluna, largura)

# Eventos - Cadastro de O.S. (t_lcadOs.ui)
form_cad_os.btnSalvarOS.clicked.connect(salvar_ordem_servico)
form_cad_os.btnCancelar.clicked.connect(form_cad_os.close)

# Eventos - Pátio
form_patio.btnVoltar.clicked.connect(form_patio.close)
form_patio.btnRegistrarEntrada.clicked.connect(carregar_patio)
form_patio.btnDarSaida.clicked.connect(alterar_status_patio)
form_patio.txtBuscarPatio.textChanged.connect(filtrar_patio)
form_patio.cmbSetor.currentTextChanged.connect(filtrar_patio)
form_patio.gridPatio.setEditTriggers(QtWidgets.QAbstractItemView.NoEditTriggers)

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

