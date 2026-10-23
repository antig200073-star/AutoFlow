import os
os.environ.setdefault('QT_QPA_PLATFORM', 'offscreen')
import sys
import time
import unittest
from pathlib import Path
from threading import Event
from unittest.mock import Mock
from PyQt5 import uic
from PyQt5.QtWidgets import QApplication
from PyQt5.QtCore import QThreadPool
from PyQt5.QtTest import QTest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'qt'))
from order_autofill import OrderAutofill
from order_service import lookup_vehicle, vehicle_description

ROOT = Path(__file__).resolve().parents[1]
FOUND = {'status':'found','brand':'Chevrolet','model':'Celta','year':2007,'client_name':'Cliente A'}


class OrderAutofillTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = QApplication.instance() or QApplication([])

    def setUp(self):
        self.form = uic.loadUi(str(ROOT / 'qt/t_cadOs.ui'))
        self.pool = QThreadPool()
        self.lookup = Mock(return_value=FOUND)
        self.controller = OrderAutofill(self.form, lookup=self.lookup, pool=self.pool, delay_ms=15)
        self.form.show()
        self.app.processEvents()

    def tearDown(self):
        self.form.close()
        self.pool.waitForDone(3000)
        self.app.processEvents()
        self.form.removeEventFilter(self.controller)
        self.form.deleteLater()
        self.app.processEvents()

    def wait_until(self, condition):
        deadline=time.monotonic()+3
        while not condition() and time.monotonic()<deadline:
            QTest.qWait(10)
        self.assertTrue(condition())

    def test_autofill_and_no_duplicate_request_when_leaving_plate(self):
        self.form.txtPlaca.setText('abc-1234')
        self.wait_until(lambda: self.controller.state=='found')
        self.assertEqual(self.form.txtVeiculo.text(),'Chevrolet Celta 2007')
        self.assertEqual(self.form.txtCliente.text(),'Cliente A')
        self.assertTrue(self.form.txtCliente.isReadOnly())
        self.assertTrue(self.form.btnSalvarOS.isEnabled())
        self.form.txtPlaca.editingFinished.emit()
        QTest.qWait(30)
        self.lookup.assert_called_once_with('ABC1234','')

    def test_invalid_plate_skips_request_and_clears_previous_data(self):
        self.form.txtPlaca.setText('ABC1234')
        self.wait_until(lambda: self.controller.state=='found')
        self.form.txtPlaca.setText('ABC')
        QTest.qWait(30)
        self.assertEqual(self.form.txtCliente.text(),'')
        self.assertEqual(self.form.txtVeiculo.text(),'')
        self.assertFalse(self.form.btnSalvarOS.isEnabled())
        self.assertEqual(self.lookup.call_count,1)

    def test_new_plate_allows_manual_entry(self):
        self.lookup.return_value={'status':'not_found'}
        self.form.txtPlaca.setText('XYZ9J87')
        self.wait_until(lambda: self.controller.state=='not_found')
        self.assertFalse(self.form.txtCliente.isReadOnly())
        self.assertTrue(self.form.btnSalvarOS.isEnabled())

    def test_first_link_then_code_autofills(self):
        self.lookup.side_effect=[{'status':'needs_link'},FOUND]
        self.form.txtPlaca.setText('ABC1234')
        self.wait_until(lambda: self.controller.state=='needs_link')
        self.assertFalse(self.form.btnSalvarOS.isEnabled())
        self.assertEqual(self.form.txtCliente.text(),'')
        self.form.txtCodigoVinculo.setText('00000000-0000-0000-0000-000000000001')
        self.wait_until(lambda: self.controller.state=='found')
        self.assertEqual(self.form.txtCliente.text(),'Cliente A')

    def test_error_can_be_retried(self):
        self.lookup.side_effect=[RuntimeError('network'),FOUND]
        self.form.txtPlaca.setText('ABC1234')
        self.wait_until(lambda: self.controller.state=='error')
        self.assertFalse(self.form.btnSalvarOS.isEnabled())
        self.form.btnConsultarPlaca.click()
        self.wait_until(lambda: self.controller.state=='found')

    def test_slow_previous_plate_cannot_overwrite_current_plate(self):
        started, release = Event(), Event()
        def lookup(plate, code):
            if plate=='ABC1234':
                started.set(); release.wait(2)
                return FOUND
            return {**FOUND,'brand':'Honda','model':'Civic','client_name':'Cliente B'}
        self.controller.lookup=lookup
        self.form.txtPlaca.setText('ABC1234')
        self.wait_until(started.is_set)
        try:
            self.form.txtPlaca.setText('DEF4G56')
            self.wait_until(lambda: self.form.txtCliente.text()=='Cliente B')
        finally:
            release.set()
        self.pool.waitForDone(3000); self.app.processEvents()
        self.assertEqual(self.form.txtCliente.text(),'Cliente B')

    def test_response_after_close_does_not_repopulate_form(self):
        started, release = Event(), Event()
        def lookup(plate, code):
            started.set(); release.wait(2)
            return FOUND
        self.controller.lookup=lookup
        self.form.txtPlaca.setText('ABC1234')
        self.wait_until(started.is_set)
        self.form.close(); release.set()
        self.pool.waitForDone(3000); self.app.processEvents()
        self.assertEqual(self.form.txtCliente.text(),'')
        self.assertFalse(self.controller.can_submit())

    def test_service_normalizes_plate_and_does_not_guess_missing_year(self):
        db=Mock(); db.rpc.return_value.execute.return_value.data=FOUND
        self.assertEqual(lookup_vehicle(db,'abc-1234',' code '),FOUND)
        db.rpc.assert_called_once_with('lookup_workshop_vehicle',{'p_plate':'ABC1234','p_link_code':'code'})
        self.assertEqual(vehicle_description({'model':'Modelo antigo','year':None}),'Modelo antigo')
        self.assertEqual(vehicle_description({'model':'Celta','year':2007.0}),'Celta 2007')


if __name__=='__main__':
    unittest.main()
