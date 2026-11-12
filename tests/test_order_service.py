import sys
import unittest
from pathlib import Path
from unittest.mock import Mock
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'qt'))
from order_service import create_order, order_error
PAYLOAD = {'p_plate': 'ABC1D23', 'p_model': 'Fiat Uno', 'p_client': 'Cliente', 'p_problem': 'Revisão', 'p_status': 'em_analise'}

class OrderServiceTests(unittest.TestCase):
    def test_link_code_is_sent_to_linked_rpc(self):
        db = Mock()
        payload = dict(PAYLOAD)
        create_order(db, payload, ' 000042 ')
        db.rpc.assert_called_once_with('create_workshop_order_with_link', {**PAYLOAD, 'p_link_code': '000042'})
        self.assertEqual(payload, PAYLOAD)

    def test_existing_workflow_without_code_remains_supported(self):
        db = Mock()
        create_order(db, PAYLOAD)
        db.rpc.assert_called_once_with('create_workshop_order', PAYLOAD)

    def test_failure_does_not_retry_as_unlinked(self):
        db = Mock()
        db.rpc.return_value.execute.side_effect = ValueError('Código expirado')
        with self.assertRaisesRegex(ValueError, 'Código expirado'):
            create_order(db, PAYLOAD, '000042')
        self.assertEqual(db.rpc.call_count, 1)
        self.assertEqual(order_error(ValueError('Código expirado')), 'Código expirado')

    def test_order_values_are_saved_together(self):
        db = Mock()
        create_order(db, {**PAYLOAD, 'p_services': ' Filtro de óleo ', 'p_labor': '120.50', 'p_parts': 80}, '000042')
        db.rpc.assert_called_once_with('create_workshop_order_validated', {
            **PAYLOAD, 'p_services': 'Filtro de óleo', 'p_labor': 120.5, 'p_parts': 80.0, 'p_link_code': '000042'})

    def test_invalid_inputs_never_call_server(self):
        for changed in ({'p_plate': 'ABC'}, {'p_model': ''}, {'p_client': ' '}, {'p_problem': 'x' * 4001}, {'p_status': 'pronto'},
                        {'p_labor': -1}, {'p_parts': 'NaN'}, {'p_parts': 1.234}, {'p_services': 'x' * 4001}):
            with self.subTest(changed=changed):
                db = Mock()
                with self.assertRaises(ValueError):
                    create_order(db, {**PAYLOAD, **changed})
                db.rpc.assert_not_called()

if __name__ == '__main__':
    unittest.main()
