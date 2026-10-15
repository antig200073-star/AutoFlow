import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "qt"))
from order_rows import order_row_values, format_entry_date


class OrderTableTests(unittest.TestCase):
    def test_order_row_with_nested_relations(self):
        order = {
            "id": 1,
            "status": "em_analise",
            "descricao_problema": "Motor falhando",
            "data_entrada": "2026-10-15T00:47:41+00:00",
            "tb_veiculo": {"placa": "ABC1234", "marca": None, "modelo": "Celta 1.0"},
            "tb_cli": {"nome": "Cliente de Teste"},
        }
        cols = order_row_values(order)
        self.assertEqual(len(cols), 7)
        self.assertEqual(cols[:6], ["1", "ABC1234", "Celta 1.0", "Cliente de Teste",
                                    "Motor falhando", "Em Diagnóstico"])
        self.assertRegex(cols[6], r"^\d{2}/\d{2}/\d{4} \d{2}:\d{2}$")

    def test_missing_fields_are_safe(self):
        self.assertEqual(order_row_values({})[:6], ["—"] * 6)
        self.assertEqual(format_entry_date(None), "—")
        self.assertEqual(format_entry_date("data inválida"), "data inválida")

    def test_status_display(self):
        self.assertEqual(order_row_values({"status": "aguardando"})[5], "Aguardando peças")
        self.assertEqual(order_row_values({"status": "pronto"})[5], "Pronto para retirada")


if __name__ == "__main__":
    unittest.main()
