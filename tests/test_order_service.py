import sys
import unittest
from pathlib import Path
from unittest.mock import Mock
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'qt'))
from order_service import create_order, order_error

class OrderServiceTests(unittest.TestCase):
    def test_link_code_is_sent_to_linked_rpc(self):
        db = Mock()
        payload = {'p_plate': 'ABC1D23'}
        create_order(db, payload, ' code ')
        db.rpc.assert_called_once_with('create_workshop_order_with_link', {'p_plate': 'ABC1D23', 'p_link_code': 'code'})
        self.assertEqual(payload, {'p_plate': 'ABC1D23'})

    def test_existing_workflow_without_code_remains_supported(self):
        db = Mock()
        create_order(db, {'p_plate': 'ABC1D23'})
        db.rpc.assert_called_once_with('create_workshop_order', {'p_plate': 'ABC1D23'})

    def test_failure_does_not_retry_as_unlinked(self):
        db = Mock()
        db.rpc.return_value.execute.side_effect = ValueError('Código expirado')
        with self.assertRaisesRegex(ValueError, 'Código expirado'):
            create_order(db, {}, 'code')
        self.assertEqual(db.rpc.call_count, 1)
        self.assertEqual(order_error(ValueError('Código expirado')), 'Código expirado')

if __name__ == '__main__':
    unittest.main()
