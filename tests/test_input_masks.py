import os
os.environ.setdefault('QT_QPA_PLATFORM', 'offscreen')
import sys
import unittest
from pathlib import Path
from PyQt5 import uic
from PyQt5.QtWidgets import QApplication, QLineEdit
from PyQt5.QtCore import Qt
from PyQt5.QtTest import QTest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'qt'))
from input_rules import cnpj_value, format_cnpj, valid_cnpj, email_value, link_code_value, money_value
from input_masks import LineMask, configure_inputs


class InputTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = QApplication.instance() or QApplication([])

    def test_cnpj_numeric_alphanumeric_and_reserved_demo(self):
        for value in ('11.222.333/0001-81', '00.000.000/E08G-12', '12.ABC.345/01DE-35'):
            self.assertTrue(valid_cnpj(value), value)
            self.assertEqual(format_cnpj(cnpj_value(value)), value)
        self.assertEqual(cnpj_value('00.000.000/0000-01'), '00000000000001')
        for value in ('11111111111111', '11222333000182', '123', 'ábc34567890123'):
            with self.assertRaises(ValueError):
                cnpj_value(value)

    def test_formatted_cnpj_paste_edit_and_backspace(self):
        field = QLineEdit()
        mask = LineMask(field, format_cnpj)
        QTest.keyClicks(field, '11222333000181')
        self.assertEqual(field.text(), '11.222.333/0001-81')
        field.setCursorPosition(3)
        QTest.keyClick(field, Qt.Key_Backspace)
        self.assertEqual(field.text().replace('.', '').replace('/', '').replace('-', ''), '1222333000181')
        field.setText('112223330001819')
        mask.apply()
        self.assertEqual(field.text(), '112223330001819')
        field.deleteLater()

    def test_email_codes_and_values(self):
        self.assertEqual(email_value(' TESTE@EXAMPLE.COM '), 'teste@example.com')
        self.assertEqual(link_code_value(' 000042 '), '000042')
        self.assertEqual(money_value('99999.99'), 99999.99)
        for value in ('42', '12345', '1234567', 'ABC123'):
            with self.assertRaises(ValueError):
                link_code_value(value)
        for value in ('NaN', 'Infinity', -1, 100000, 1.234):
            with self.assertRaises(ValueError):
                money_value(value)

    def test_money_fields_use_brazilian_locale_and_keep_cents(self):
        forms = [uic.loadUi(str(ROOT / 'qt' / name)) for name in ('t_loguin.ui', 't_cad.ui', 't_cadOs.ui', 't_prin.ui', 't_veipatio.ui')]
        masks = configure_inputs(*forms)
        order = forms[2]
        order.spinMaoObra.setValue(1234.56)
        self.assertEqual(order.spinMaoObra.text(), 'R$ 1.234,56')
        order.spinPecas.lineEdit().setText('R$ 80,50')
        self.assertTrue(order.spinPecas.hasAcceptableInput())
        order.spinPecas.interpretText()
        self.assertEqual(order.spinPecas.value(), 80.5)
        self.assertEqual(len(masks), 2)
        for form in forms:
            form.deleteLater()


if __name__ == '__main__':
    unittest.main()
