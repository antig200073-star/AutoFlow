import json
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "qt"))
from workshop_auth import require_approved, register_workshop


class WorkshopAuthTests(unittest.TestCase):
    def client_for(self, status):
        client = Mock()
        client.auth.get_user.return_value = SimpleNamespace(user=SimpleNamespace(id="owner"))
        client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [{"id": 1, "status": status}]
        return client

    def test_only_approved_can_enter(self):
        for status in ("pendente", "em_verificacao", "bloqueada", "rejeitada", None):
            with self.subTest(status=status), self.assertRaises(PermissionError):
                require_approved(self.client_for(status))
        self.assertEqual(require_approved(self.client_for("aprovada"))["id"], 1)

    def test_registration_sends_only_cnpj_and_requires_confirmation(self):
        client = Mock()
        client.functions.invoke.return_value = json.dumps({"success": True}).encode()
        register_workshop(client, "11222333000181")
        client.functions.invoke.assert_called_once_with("register-workshop", invoke_options={"body": {"cnpj": "11222333000181"}})
        client.functions.invoke.return_value = b'{"error":"CNPJ inativo"}'
        with self.assertRaisesRegex(ValueError, "inativo"):
            register_workshop(client, "11222333000181")


if __name__ == "__main__":
    unittest.main()
