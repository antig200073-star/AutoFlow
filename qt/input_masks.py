"""Máscaras da interface Qt sem alterar os valores das senhas."""
from PyQt5.QtCore import QObject, QEvent, QLocale, Qt
from input_rules import format_cnpj, format_plate


class LineMask(QObject):
    def __init__(self, field, formatter):
        super().__init__(field)
        self.field, self.formatter = field, formatter
        field.textEdited.connect(self.apply)
        field.installEventFilter(self)

    def apply(self):
        field = self.field
        old, cursor = field.text(), field.cursorPosition()
        formatted = self.formatter(old)
        if old == formatted:
            return
        count = sum(char.isalnum() for char in old[:cursor])
        position = 0
        for position, char in enumerate(formatted, 1):
            if char.isalnum():
                count -= 1
            if count <= 0:
                break
        if cursor == len(old):
            position = len(formatted)
        field.setText(formatted)
        field.setCursorPosition(position if cursor else 0)

    def eventFilter(self, obj, event):
        if event.type() == QEvent.KeyPress and not self.field.hasSelectedText() and event.modifiers() == Qt.NoModifier:
            text, cursor = self.field.text(), self.field.cursorPosition()
            start = end = cursor
            if event.key() == Qt.Key_Backspace and start and not text[start - 1].isalnum():
                while start and not text[start - 1].isalnum():
                    start -= 1
                start = max(0, start - 1)
            elif event.key() == Qt.Key_Delete and end < len(text) and not text[end].isalnum():
                while end < len(text) and not text[end].isalnum():
                    end += 1
                end = min(len(text), end + 1)
            else:
                return False
            self.field.setText(text[:start] + text[end:])
            self.field.setCursorPosition(start)
            self.apply()
            return True
        return False


def configure_inputs(login, registration, order, dashboard, patio):
    masks = [LineMask(registration.txtCnpj, format_cnpj), LineMask(order.txtPlaca, format_plate)]
    # Não corta colagens: conteúdo excedente permanece visível e é recusado ao salvar.
    registration.txtCnpj.setMaxLength(128)
    registration.txtCnpj.setPlaceholderText('12.345.678/0001-95')
    registration.txtCnpj.setToolTip('14 caracteres; aceita o CNPJ numérico e o alfanumérico.')
    order.txtPlaca.setPlaceholderText('ABC1D23 ou ABC-1234')
    order.txtCodigoVinculo.setMaxLength(128)
    order.txtCodigoVinculo.setToolTip('Seis números, incluindo zeros iniciais. Códigos antigos completos também são aceitos.')
    for field in (login.txtUsuario, registration.txtEmail):
        field.setMaxLength(254)
        field.setPlaceholderText('nome@exemplo.com')
    order.txtCliente.setMaxLength(150)
    order.txtVeiculo.setMaxLength(150)
    order.txtDefeito.setAcceptRichText(False)
    order.txtPecasServicos.setAcceptRichText(False)
    for field in (order.txtDefeito, order.txtPecasServicos):
        field.setToolTip('Até 4.000 caracteres. O texto será validado antes de salvar.')
        field.setPlaceholderText('Descreva aqui (até 4.000 caracteres).')
    for field in (dashboard.txtBuscar, patio.txtBuscarPatio):
        field.setMaxLength(150)
    for field in (order.spinMaoObra, order.spinPecas):
        field.setLocale(QLocale(QLocale.Portuguese, QLocale.Brazil))
        field.setPrefix('R$ ')
        field.setDecimals(2)
        field.setRange(0, 99999.99)
        field.setGroupSeparatorShown(True)
        field.setKeyboardTracking(False)
    return masks
