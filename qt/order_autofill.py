"""Consulta de placa em segundo plano, com descarte de respostas de formulários antigos."""
from PyQt5.QtCore import QObject, QRunnable, QThreadPool, QTimer, QEvent, Qt, pyqtSignal, pyqtSlot
from order_service import lookup_vehicle, lookup_error, normalize_plate, valid_plate, vehicle_description


class LookupSignals(QObject):
    completed = pyqtSignal(int, object, object)


class LookupJob(QRunnable):
    def __init__(self, revision, lookup, plate, code):
        super().__init__()
        self.revision, self.lookup, self.plate, self.code = revision, lookup, plate, code
        self.signals = LookupSignals()

    def run(self):
        try:
            result = self.lookup(self.plate, self.code)
        except Exception as error:
            self.signals.completed.emit(self.revision, None, error)
        else:
            self.signals.completed.emit(self.revision, result, None)


class OrderAutofill(QObject):
    MESSAGES = {
        "found": "Dados preenchidos a partir do cadastro do veículo.",
        "not_found": "Placa não cadastrada no AutoFlow. Preencha os dados para um atendimento avulso.",
        "needs_link": "Primeiro atendimento: informe o código de vínculo do cliente para preencher os dados.",
        "needs_review": "Esta placa possui cadastro avulso em outra oficina. Peça a conferência do vínculo ao responsável do AutoFlow.",
        "removed": "O veículo foi removido da lista do cliente. Peça que ele cadastre novamente e gere o código de vínculo.",
        "invalid_link": "Código inválido, vencido, utilizado ou de outra placa. Confira com o cliente.",
    }

    def __init__(self, form, db=None, lookup=None, pool=None, delay_ms=400):
        super().__init__(form)
        self.form = form
        self.lookup = lookup or (lambda plate, code: lookup_vehicle(db, plate, code))
        self.pool = pool or QThreadPool.globalInstance()
        self.jobs = {}
        self.revision = 0
        self.key = None
        self.state = "idle"
        self.timer = QTimer(self)
        self.timer.setSingleShot(True)
        self.timer.setInterval(delay_ms)
        self.timer.timeout.connect(self.request)
        form.txtPlaca.textChanged.connect(self.inputs_changed)
        form.txtCodigoVinculo.textChanged.connect(self.inputs_changed)
        form.txtPlaca.editingFinished.connect(self.request)
        form.txtCodigoVinculo.editingFinished.connect(self.request)
        form.btnConsultarPlaca.clicked.connect(lambda: self.request(force=True))
        form.installEventFilter(self)
        self.reset()

    def current_key(self):
        return (normalize_plate(self.form.txtPlaca.text()), self.form.txtCodigoVinculo.text().strip().lower())

    def reset(self):
        self.timer.stop()
        self.revision += 1
        self.key = None
        self.state = "idle"
        self.clear_fields()
        self.form.btnSalvarOS.setEnabled(False)
        self.form.btnConsultarPlaca.setEnabled(False)
        self.form.lblConsultaPlaca.setText("Digite a placa para preencher os dados cadastrados no AutoFlow.")

    def clear_fields(self):
        for field in (self.form.txtVeiculo, self.form.txtCliente):
            field.clear()
            field.setReadOnly(False)

    def inputs_changed(self):
        key = self.current_key()
        if key == self.key:
            return
        self.timer.stop()
        self.revision += 1
        self.key, self.state = key, "idle"
        self.clear_fields()
        self.form.btnSalvarOS.setEnabled(False)
        self.form.btnConsultarPlaca.setEnabled(valid_plate(key[0]))
        self.form.lblConsultaPlaca.setText("Digite uma placa completa (ex.: ABC1234 ou ABC1D23).")
        if valid_plate(key[0]) and self.form.isVisible():
            self.form.lblConsultaPlaca.setText("Aguardando a consulta da placa…")
            self.timer.start()

    def request(self, force=False):
        if not self.form.isVisible() or not valid_plate(self.current_key()[0]):
            return
        if self.current_key() != self.key:
            self.inputs_changed()
        if self.revision in self.jobs or (not force and self.state != "idle"):
            return
        self.timer.stop()
        self.revision += 1
        self.state = "loading"
        self.clear_fields()
        self.form.btnSalvarOS.setEnabled(False)
        self.form.btnConsultarPlaca.setEnabled(False)
        self.form.lblConsultaPlaca.setText("Consultando os dados da placa…")
        job = LookupJob(self.revision, self.lookup, *self.key)
        self.jobs[self.revision] = job
        job.signals.completed.connect(self.completed, Qt.QueuedConnection)
        self.pool.start(job)

    @pyqtSlot(int, object, object)
    def completed(self, revision, result, error):
        self.jobs.pop(revision, None)
        if revision != self.revision or not self.form.isVisible() or self.current_key() != self.key:
            return
        self.form.btnConsultarPlaca.setEnabled(True)
        if error or not isinstance(result, dict) or result.get("status") not in self.MESSAGES:
            self.state = "error"
            self.form.lblConsultaPlaca.setText(lookup_error(error))
            return
        self.state = result["status"]
        if self.state == "found":
            self.form.txtVeiculo.setText(vehicle_description(result))
            self.form.txtCliente.setText(result.get("client_name") or "")
            self.form.txtVeiculo.setReadOnly(True)
            self.form.txtCliente.setReadOnly(True)
        self.form.lblConsultaPlaca.setText(self.MESSAGES[self.state])
        self.form.btnSalvarOS.setEnabled(self.can_submit())

    def can_submit(self):
        return self.state in ("found", "not_found") and self.current_key() == self.key

    def eventFilter(self, obj, event):
        # Qt também entrega eventos durante a destruição da janela.
        if obj is getattr(self, "form", None) and hasattr(self, "timer") and event.type() == QEvent.Hide:
            self.reset()
        return super().eventFilter(obj, event)
