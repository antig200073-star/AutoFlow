"""Janela de mensagens da oficina por ordem de serviço (Supabase Auth + RLS)."""
from PyQt5 import QtWidgets, QtCore
from html import escape


class ChatWindow(QtWidgets.QDialog):
    def __init__(self, db, oficina_id, parent=None):
        super().__init__(parent)
        self.db = db
        self.oficina_id = oficina_id
        self.conversation_id = None
        self.user_id = None
        self.setWindowTitle("AutoFlow — Chat com clientes")
        self.resize(620, 500)
        layout = QtWidgets.QVBoxLayout(self)
        layout.addWidget(QtWidgets.QLabel("Selecione uma O.S. da sua oficina:"))
        self.orders = QtWidgets.QComboBox()
        layout.addWidget(self.orders)
        self.messages = QtWidgets.QTextBrowser()
        layout.addWidget(self.messages)
        self.editor = QtWidgets.QTextEdit()
        self.editor.setMaximumHeight(80)
        self.editor.setPlaceholderText("Mensagem para o cliente...")
        layout.addWidget(self.editor)
        self.status = QtWidgets.QLabel("")
        layout.addWidget(self.status)
        send = QtWidgets.QPushButton("Enviar")
        send.clicked.connect(self.send_message)
        layout.addWidget(send)
        self.orders.currentIndexChanged.connect(self.load_conversation)
        self.timer = QtCore.QTimer(self)
        self.timer.setInterval(5000)
        self.timer.timeout.connect(self.load_messages)
        self.timer.start()
        try:
            self.user_id = db.auth.get_user().user.id
            response = db.table("ordens_servico").select("id").eq("oficina_id", oficina_id).order("id",desc=True).execute()
            for order in response.data or []:
                self.orders.addItem("O.S. nº " + str(order["id"]), order["id"])
            if self.orders.count(): self.load_conversation()
        except Exception as error:
            self.status.setText("Não foi possível carregar as ordens: " + str(error))

    def load_conversation(self, *_):
        os_id = self.orders.currentData()
        self.conversation_id = None
        self.messages.clear()
        if not os_id: return
        try:
            result = self.db.table("chat_conversas").select("id").eq("ordem_servico_id", os_id).execute()
            if result.data:
                self.conversation_id = result.data[0]["id"]
            else:
                try:
                    created = self.db.table("chat_conversas").insert({"ordem_servico_id":os_id}).execute()
                    self.conversation_id = created.data[0]["id"]
                except Exception:
                    reread = self.db.table("chat_conversas").select("id").eq("ordem_servico_id",os_id).execute()
                    if not reread.data: raise
                    self.conversation_id = reread.data[0]["id"]
            self.load_messages()
        except Exception as error:
            self.status.setText("Chat indisponível: " + str(error))

    def load_messages(self):
        if not self.conversation_id or not self.isVisible(): return
        try:
            rows = self.db.table("chat_mensagens").select("remetente_id,conteudo,criada_em").eq(
                "conversa_id", self.conversation_id).order("criada_em").limit(200).execute().data
            self.messages.clear()
            for row in rows or []:
                sender = "Oficina" if row["remetente_id"] == self.user_id else "Cliente"
                self.messages.append(escape(f"{sender} ({row['criada_em'][:16]}):"))
                self.messages.append(escape(row["conteudo"]))
                self.messages.append("")
            self.status.setText("")
        except Exception:
            self.status.setText("Falha ao atualizar mensagens. Verifique a conexão.")

    def send_message(self):
        content = self.editor.toPlainText().strip()
        if not self.conversation_id or not content: return
        if len(content) > 2000:
            self.status.setText("A mensagem deve ter no máximo 2000 caracteres.")
            return
        try:
            self.db.table("chat_mensagens").insert({
                "conversa_id": self.conversation_id, "remetente_id": self.user_id, "conteudo": content
            }).execute()
            self.editor.clear()
            self.load_messages()
        except Exception as error:
            self.status.setText("Falha ao enviar: " + str(error))
